import asyncio
import json
from datetime import datetime

import redis

from backend.app.config import get_settings
from backend.app.channel_router import route_message
from backend.app.decision_engine import decide_next_action
from backend.app.booking_engine import suggest_available_times
from backend.app.event_store import (
    EVENT_STATUS_DEAD_LETTER,
    EVENT_STATUS_FAILED,
    EVENT_STATUS_PROCESSING,
    EVENT_STATUS_RETRYING,
    EVENT_STATUS_SUCCESS,
    event_already_processed,
    get_event_by_id,
    mark_event_processing,
    mark_event_status,
    move_to_dead_letter,
)
from backend.app.events import emit_event
from backend.app.logging_store import log_event
from backend.app.matching_engine import generate_matching_message, match_properties
from backend.app.queue import enqueue_event, queue_name_for_agency, release_due_delayed_events
from backend.app.rate_limiter import RateLimitExceededError, enforce_per_tenant_rate_limit
from backend.app.supabase_client import get_supabase
from backend.worker.retry_manager import dispatch_outbox_once as retry_dispatch_outbox_once


HOT_EVENT = "lead.hot"
FOLLOWUP_EVENT = "lead.followup"
RECOGNIZED_EVENTS = {"lead.created", "lead.updated", HOT_EVENT, "lead.booked", FOLLOWUP_EVENT}

settings = get_settings()
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
supabase = get_supabase()


def queue_for_mode(is_demo: bool) -> str:
    return "events:test" if is_demo else "events:main"


def fetch_lead(agency_id: str, lead_id: str) -> dict | None:
    select_clause = "id,agency_id,name,email,phone,budget,budget_value,location,timeline,timeline_normalized,status,whatsapp_sent,preferred_channel,last_channel_used,delivery_status"
    try:
        result = (
            supabase.table("leads")
            .select(select_clause)
            .eq("id", lead_id)
            .eq("agency_id", agency_id)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception:  # noqa: BLE001
        fallback_result = (
            supabase.table("leads")
            .select("id,agency_id,name,email,phone,budget,budget_value,location,timeline,timeline_normalized,status,whatsapp_sent")
            .eq("id", lead_id)
            .eq("agency_id", agency_id)
            .maybe_single()
            .execute()
        )
        return fallback_result.data


def update_delivery_state(agency_id: str, lead_id: str, channel: str | None, status: str) -> None:
    payload = {"delivery_status": status}
    if channel:
        payload["last_channel_used"] = channel
    (
        supabase.table("leads")
        .update(payload)
        .eq("id", lead_id)
        .eq("agency_id", agency_id)
        .execute()
    )


def _parse_iso_datetime(value: str) -> datetime | None:
    try:
        normalized = value.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except Exception:  # noqa: BLE001
        return None


def fetch_engagement_metrics(lead_id: str) -> dict:
    messages_result = (
        supabase.table("messages")
        .select("role,timestamp")
        .eq("lead_id", lead_id)
        .order("timestamp", desc=False)
        .limit(300)
        .execute()
    )
    messages = messages_result.data or []

    response_times: list[float] = []
    last_user_ts: datetime | None = None

    for msg in messages:
        role = str(msg.get("role") or "")
        ts_raw = str(msg.get("timestamp") or "")
        ts = _parse_iso_datetime(ts_raw)
        if ts is None:
            continue

        if role == "user":
            last_user_ts = ts
        elif role == "assistant" and last_user_ts is not None:
            delta_seconds = (ts - last_user_ts).total_seconds()
            if delta_seconds >= 0:
                response_times.append(delta_seconds)
            last_user_ts = None

    average_response = sum(response_times) / len(response_times) if response_times else 1800.0
    return {
        "messages_count": len(messages),
        "avg_response_time_seconds": average_response,
    }


def persist_decision(agency_id: str, lead_id: str, decision: dict) -> None:
    update_payload = {
        "lead_score": int(decision["score"]),
        "lead_category": decision["category"],
        "next_action": decision["action"],
        "status": decision["category"].lower(),
    }
    supabase.table("leads").update(update_payload).eq("id", lead_id).eq("agency_id", agency_id).execute()


def execute_decision_action(agency_id: str, lead_id: str, event_id: str, decision: dict, lead: dict) -> None:
    action = decision["action"]
    if action == "send_whatsapp":
        matches = match_properties(lead)
        recommendation_message = generate_matching_message(matches)
        booking_suggestion = suggest_available_times(str(lead.get("agent_id") or "") or None)
        log_event(
            agency_id,
            lead_id,
            HOT_EVENT,
            "property_matching",
            f"{recommendation_message}; top_ids={[item.get('id') for item in matches[:3]]}",
            event_id=event_id,
        )
        log_event(
            agency_id,
            lead_id,
            HOT_EVENT,
            "booking_suggestion",
            booking_suggestion,
            event_id=event_id,
        )
        asyncio.run(
            send_hot_lead_notification(
                agency_id,
                lead,
                event_id,
                f"{recommendation_message}. {booking_suggestion}",
            )
        )
        return

    if action == "schedule_followup":
        emit_event(
            FOLLOWUP_EVENT,
            {"lead_id": lead_id, "agency_id": agency_id},
            max_attempts=6,
            delay_seconds=3600,
        )


def evaluate_and_decide(agency_id: str, lead_id: str, event_id: str, event_type: str) -> None:
    lead = fetch_lead(agency_id, lead_id)
    if not lead:
        raise RuntimeError("lead not found for agency scope")

    engagement = fetch_engagement_metrics(lead_id)
    decision_input = {
        **lead,
        **engagement,
    }
    decision = decide_next_action(decision_input)
    persist_decision(agency_id, lead_id, decision)
    execute_decision_action(agency_id, lead_id, event_id, decision, lead)

    log_event(
        agency_id,
        lead_id,
        event_type,
        "decision_made",
        f"score={decision['score']} category={decision['category']} action={decision['action']}",
        event_id=event_id,
    )


def build_hot_lead_message(lead: dict, recommendation_message: str | None = None) -> str:
    base = (
        f"HOT LEAD: {lead.get('name') or 'Unknown'} | "
        f"Budget: {lead.get('budget') or 'N/A'} | "
        f"Location: {json.dumps(lead.get('location') or {})} | "
        f"Timeline: {lead.get('timeline') or 'N/A'}"
    )

    if recommendation_message:
        return f"{base} | {recommendation_message}"
    return base


async def send_hot_lead_notification(agency_id: str, lead: dict, event_id: str, recommendation_message: str | None = None) -> None:
    idempotency_key = f"idempotency:whatsapp:{event_id}"
    locked = redis_client.set(idempotency_key, "1", nx=True, ex=60 * 60 * 24)
    if not locked:
        log_event(agency_id, lead["id"], HOT_EVENT, "duplicate", "Duplicate notification prevented by event_id", event_id=event_id)
        return

    if lead.get("whatsapp_sent"):
        log_event(agency_id, lead["id"], HOT_EVENT, "ignored", "Notification already sent", event_id=event_id)
        return

    recipient = lead.get("phone") or lead.get("email")
    if not recipient:
        raise RuntimeError("lead has no recipient contact")

    channel = str(lead.get("preferred_channel") or "").strip().lower() or "whatsapp"
    enforce_per_tenant_rate_limit(agency_id, channel)
    response = await route_message(
        lead=lead,
        to=recipient,
        content=build_hot_lead_message(lead, recommendation_message),
        metadata={"event_id": event_id, "agency_id": agency_id, "lead_id": lead["id"], "event_type": HOT_EVENT},
    )

    if not response.ok:
        update_delivery_state(agency_id, lead["id"], response.channel, "failed")
        redis_client.delete(idempotency_key)
        error_detail = response.attempts[-1].message if response.attempts else "all channel attempts failed"
        raise RuntimeError(error_detail)

    (
        supabase.table("leads")
        .update({
            "whatsapp_sent": True,
            "last_channel_used": response.channel,
            "delivery_status": response.status,
        })
        .eq("id", lead["id"])
        .eq("agency_id", agency_id)
        .execute()
    )

    log_event(
        agency_id,
        lead["id"],
        HOT_EVENT,
        "provider_success",
        f"Provider={response.channel} sent",
        event_id=event_id,
    )


def get_backoff_seconds(attempt: int) -> int:
    if attempt <= 1:
        return 30
    if attempt == 2:
        return 120
    if attempt == 3:
        return 600
    return 3600


def parse_message(message: dict) -> tuple[str, str, dict, str, str | None]:
    event_id = str(message.get("event_id", "")).strip()
    event_type = str(message.get("type", "")).strip()
    payload = message.get("payload", {}) or {}
    agency_id = str(payload.get("agency_id", "")).strip()
    lead_id = str(payload.get("lead_id", "")).strip() if payload.get("lead_id") else None
    return event_id, event_type, payload, agency_id, lead_id


def mark_success_and_log(agency_id: str, lead_id: str | None, event_type: str, event_id: str, attempt: int) -> None:
    mark_event_status(event_id, EVENT_STATUS_SUCCESS)
    log_event(agency_id, lead_id, event_type, EVENT_STATUS_SUCCESS, "Event processed", attempt, event_id=event_id)


def process_hot_event(agency_id: str, lead_id: str, event_id: str) -> bool:
    lead = fetch_lead(agency_id, lead_id)
    if not lead:
        raise RuntimeError("lead not found for agency scope")

    if lead.get("status") != "hot":
        mark_event_status(event_id, EVENT_STATUS_SUCCESS)
        log_event(agency_id, lead_id, HOT_EVENT, "ignored", "Lead not hot", event_id=event_id)
        return False

    asyncio.run(send_hot_lead_notification(agency_id, lead, event_id))
    return True


def retry_or_dead_letter(
    event_id: str,
    event_type: str,
    payload: dict,
    agency_id: str,
    lead_id: str | None,
    attempt: int,
    max_attempts: int,
    error_message: str,
) -> None:
    if attempt < max_attempts:
        backoff = get_backoff_seconds(attempt)
        mark_event_status(event_id, EVENT_STATUS_RETRYING, error_message)
        enqueue_event(event_id, event_type, payload, delay_seconds=backoff)
        log_event(
            agency_id,
            lead_id,
            event_type,
            EVENT_STATUS_RETRYING,
            f"Retry scheduled in {backoff}s",
            attempt,
            event_id=event_id,
        )
        return

    event_snapshot = get_event_by_id(event_id)
    if event_snapshot:
        move_to_dead_letter(event_snapshot, error_message)
        log_event(
            agency_id,
            lead_id,
            event_type,
            EVENT_STATUS_DEAD_LETTER,
            "Moved to dead_letter_queue",
            attempt,
            event_id=event_id,
        )


def process_event(message: dict) -> None:
    event_id, event_type, payload, agency_id, lead_id = parse_message(message)

    if not event_id or not agency_id or not event_type:
        return

    log_event(agency_id, lead_id, event_type, "received", "Event received by worker", event_id=event_id)

    if event_type not in RECOGNIZED_EVENTS:
        mark_event_status(event_id, EVENT_STATUS_SUCCESS)
        log_event(agency_id, lead_id, event_type, "ignored", "Unsupported event type", event_id=event_id)
        return

    if event_already_processed(event_id):
        log_event(agency_id, lead_id, event_type, "duplicate", "Already processed", event_id=event_id)
        return

    event_row = mark_event_processing(event_id)
    if not event_row:
        return

    if event_row.get("status") != EVENT_STATUS_PROCESSING:
        mark_event_status(event_id, EVENT_STATUS_PROCESSING)

    attempt = int(event_row.get("attempts") or 1)
    max_attempts = int(event_row.get("max_attempts") or 6)

    try:
        if not lead_id:
            raise RuntimeError("lead_id missing from event payload")

        if event_type == HOT_EVENT:
            should_mark_success = process_hot_event(agency_id, lead_id, event_id)
            if should_mark_success:
                mark_success_and_log(agency_id, lead_id, event_type, event_id, attempt)
            return

        if event_type == FOLLOWUP_EVENT:
            log_event(agency_id, lead_id, event_type, "followup_due", "Scheduled follow-up is due", event_id=event_id)
            mark_success_and_log(agency_id, lead_id, event_type, event_id, attempt)
            return

        evaluate_and_decide(agency_id, lead_id, event_id, event_type)

        mark_success_and_log(agency_id, lead_id, event_type, event_id, attempt)
    except Exception as exc:  # noqa: BLE001
        error_message = str(exc)
        mark_event_status(event_id, EVENT_STATUS_FAILED, error_message)
        log_event(agency_id, lead_id, event_type, EVENT_STATUS_FAILED, error_message, attempt, event_id=event_id)
        retry_or_dead_letter(event_id, event_type, payload, agency_id, lead_id, attempt, max_attempts, error_message)


def run_worker(is_demo: bool = False) -> None:
    queue = queue_for_mode(is_demo)
    print(f"Worker listening on {queue}")

    while True:
        release_due_delayed_events(queue, max_items=100)
        popped = redis_client.brpop(queue, timeout=3)
        if not popped:
            continue
        _, body = popped
        message = json.loads(body)
        process_event(message)


def dispatch_outbox_once(limit: int = 100) -> None:
    retry_dispatch_outbox_once(limit=limit)
