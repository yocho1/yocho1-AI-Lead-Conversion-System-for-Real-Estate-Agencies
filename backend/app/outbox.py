from datetime import datetime, timezone

from .supabase_client import get_supabase


supabase = get_supabase()


def save_outbox_event(event_id: str, event_type: str, payload: dict, agency_id: str, lead_id: str | None, max_attempts: int) -> str:
    result = (
        supabase.table("event_outbox")
        .insert(
            {
                "event_id": event_id,
                "agency_id": agency_id,
                "lead_id": lead_id,
                "event_type": event_type,
                "payload": payload,
                "status": "pending",
                "retry_count": 0,
                "max_attempts": max_attempts,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def mark_outbox_dispatched(outbox_id: str) -> None:
    (
        supabase.table("event_outbox")
        .update({"status": "dispatched", "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", outbox_id)
        .execute()
    )


def mark_outbox_failed(outbox_id: str, retry_count: int, last_error: str) -> None:
    (
        supabase.table("event_outbox")
        .update(
            {
                "status": "failed",
                "retry_count": retry_count,
                "last_error": last_error,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", outbox_id)
        .execute()


def get_pending_outbox(limit: int = 100) -> list[dict]:
    result = (
        supabase.table("event_outbox")
        .select("id,event_id,event_type,payload,retry_count,max_attempts,agency_id,lead_id")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data or []
