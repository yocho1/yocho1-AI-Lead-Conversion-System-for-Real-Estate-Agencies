from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .supabase_client import get_supabase


EVENT_STATUS_QUEUED = "queued"
EVENT_STATUS_PROCESSING = "processing"
EVENT_STATUS_SUCCESS = "success"
EVENT_STATUS_FAILED = "failed"
EVENT_STATUS_RETRYING = "retrying"
EVENT_STATUS_DEAD_LETTER = "dead_letter"

supabase = get_supabase()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_event_by_id(event_id: str) -> dict[str, Any] | None:
    result = supabase.table("events").select("*").eq("event_id", event_id).maybe_single().execute()
    return result.data


def event_already_processed(event_id: str) -> bool:
    event = get_event_by_id(event_id)
    if not event:
        return False
    return event.get("status") == EVENT_STATUS_SUCCESS


def create_or_get_event(event_type: str, payload: dict[str, Any], max_attempts: int = 3) -> tuple[str, bool]:
    agency_id = str(payload.get("agency_id", ""))
    lead_id = payload.get("lead_id")

    if not agency_id:
        raise ValueError("agency_id is required in event payload")

    if lead_id:
        existing = (
            supabase.table("events")
            .select("event_id")
            .eq("agency_id", agency_id)
            .eq("lead_id", lead_id)
            .eq("event_type", event_type)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return str(existing.data["event_id"]), False

    event_id = str(uuid4())
    supabase.table("events").insert(
        {
            "event_id": event_id,
            "agency_id": agency_id,
            "lead_id": lead_id,
            "event_type": event_type,
            "status": EVENT_STATUS_QUEUED,
            "attempts": 0,
            "max_attempts": max_attempts,
            "payload": payload,
            "created_at": _now_iso(),
            "updated_at": _now_iso(),
        }
    ).execute()
    return event_id, True


def mark_event_processing(event_id: str) -> dict[str, Any] | None:
    event = get_event_by_id(event_id)
    if not event:
        return None

    attempts = int(event.get("attempts") or 0) + 1
    result = (
        supabase.table("events")
        .update(
            {
                "status": EVENT_STATUS_PROCESSING,
                "attempts": attempts,
                "updated_at": _now_iso(),
            }
        )
        .eq("event_id", event_id)
        .execute()
    )
    return result.data[0] if result.data else get_event_by_id(event_id)


def mark_event_status(event_id: str, status: str, error_message: str | None = None) -> None:
    payload: dict[str, Any] = {
        "status": status,
        "updated_at": _now_iso(),
    }
    if error_message is not None:
        payload["last_error"] = error_message

    supabase.table("events").update(payload).eq("event_id", event_id).execute()


def move_to_dead_letter(event: dict[str, Any], error_message: str) -> None:
    supabase.table("dead_letter_queue").insert(
        {
            "event_id": event["event_id"],
            "agency_id": event["agency_id"],
            "lead_id": event.get("lead_id"),
            "event_type": event["event_type"],
            "payload": event.get("payload") or {},
            "attempts": int(event.get("attempts") or 0),
            "error_message": error_message,
            "moved_at": _now_iso(),
        }
    ).execute()
    mark_event_status(event["event_id"], EVENT_STATUS_DEAD_LETTER, error_message)
