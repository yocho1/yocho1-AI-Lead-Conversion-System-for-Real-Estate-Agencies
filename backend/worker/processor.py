import asyncio
import json

import redis

from backend.app.config import get_settings
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
from backend.app.logging_store import log_event
from backend.app.outbox import get_pending_outbox, mark_outbox_dispatched, mark_outbox_failed
from backend.app.providers import resolve_provider
from backend.app.queue import enqueue_event, queue_name_for_agency, release_due_delayed_events
from backend.app.rate_limiter import RateLimitExceededError, enforce_per_tenant_rate_limit
from backend.app.supabase_client import get_supabase


HOT_EVENT = "lead.hot"
RECOGNIZED_EVENTS = {"lead.created", "lead.updated", HOT_EVENT, "lead.booked"}

settings = get_settings()
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
supabase = get_supabase()


def queue_for_mode(is_demo: bool) -> str:
    return "events:test" if is_demo else "events:main"


def fetch_lead(agency_id: str, lead_id: str) -> dict | None:
    result = (
        supabase.table("leads")
        .select("id,agency_id,name,email,phone,budget,location,timeline,timeline_normalized,status,whatsapp_sent")
        .eq("id", lead_id)
        .eq("agency_id", agency_id)
        .maybe_single()
        .execute()
    )
    return result.data


def build_hot_lead_message(lead: dict) -> str:
    return (
        f"HOT LEAD: {lead.get('name') or 'Unknown'} | "
        f"Budget: {lead.get('budget') or 'N/A'} | "
        f"Location: {json.dumps(lead.get('location') or {})} | "
        f"Timeline: {lead.get('timeline') or 'N/A'}"
    )


async def send_hot_lead_notification(agency_id: str, lead: dict, event_id: str) -> None:
    if lead.get("whatsapp_sent"):
        log_event(agency_id, lead["id"], HOT_EVENT, "ignored", "Notification already sent", event_id=event_id)
        return

    recipient = lead.get("phone") or lead.get("email")
    if not recipient:
        raise RuntimeError("lead has no recipient contact")

    enforce_per_tenant_rate_limit(agency_id, "whatsapp")
    provider = resolve_provider("whatsapp", agency_id)
    response = await provider.send(build_hot_lead_message(lead), recipient)
    if not response.ok:
        raise RuntimeError(response.message)

    (
        supabase.table("leads")
        .update({"whatsapp_sent": True})
        .eq("id", lead["id"])
        .eq("agency_id", agency_id)
        .execute()
    )

    log_event(
        agency_id,
        lead["id"],
        HOT_EVENT,
        "provider_success",
        f"Provider={response.provider} sent",
        event_id=event_id,
    )


def get_backoff_seconds(attempt: int) -> int:
    if attempt <= 1:
        return 2
    if attempt == 2:
        return 5
    return 12


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
    max_attempts = int(event_row.get("max_attempts") or 3)

    try:
        if not lead_id:
            raise RuntimeError("lead_id missing from event payload")

        if event_type == HOT_EVENT:
            should_mark_success = process_hot_event(agency_id, lead_id, event_id)
            if should_mark_success:
                mark_success_and_log(agency_id, lead_id, event_type, event_id, attempt)
            return

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
    pending = get_pending_outbox(limit=limit)
    for item in pending:
        outbox_id = item["id"]
        event_id = str(item.get("event_id") or "")
        event_type = item["event_type"]
        payload = item["payload"]
        retries = int(item.get("retry_count") or 0)
        agency_id = str(item.get("agency_id") or payload.get("agency_id") or "")
        lead_id = item.get("lead_id") or payload.get("lead_id")

        if not event_id:
            mark_outbox_failed(outbox_id, retries + 1, "missing event_id")
            log_event(agency_id, lead_id, event_type, "error", "Outbox missing event_id", retries + 1)
            continue

        try:
            enqueue_event(event_id, event_type, payload)
            mark_outbox_dispatched(outbox_id)
            log_event(agency_id, lead_id, event_type, "queued", "Outbox dispatched", retries + 1, event_id=event_id)
        except RateLimitExceededError as exc:
            mark_outbox_failed(outbox_id, retries + 1, str(exc))
            log_event(agency_id, lead_id, event_type, "retrying", str(exc), retries + 1, event_id=event_id)
        except Exception as exc:  # noqa: BLE001
            mark_outbox_failed(outbox_id, retries + 1, str(exc))
            log_event(agency_id, lead_id, event_type, "error", str(exc), retries + 1, event_id=event_id)
