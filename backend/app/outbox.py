from datetime import datetime, timezone

from .supabase_client import get_supabase


supabase = get_supabase()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
                "next_retry_at": _now_iso(),
                "created_at": _now_iso(),
            }
        )
        .execute()
    )
    return result.data[0]["id"]


def mark_outbox_success(outbox_id: str) -> None:
    (
        supabase.table("event_outbox")
        .update({"status": "success", "updated_at": _now_iso()})
        .eq("id", outbox_id)
        .execute()
    )


def mark_outbox_retry_pending(outbox_id: str, retry_count: int, next_retry_at: str, last_error: str) -> None:
    (
        supabase.table("event_outbox")
        .update(
            {
                "status": "pending",
                "retry_count": retry_count,
                "next_retry_at": next_retry_at,
                "last_error": last_error,
                "updated_at": _now_iso(),
            }
        )
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
                "updated_at": _now_iso(),
            }
        )
        .eq("id", outbox_id)
        .execute()
    )


def move_outbox_to_failed_table(item: dict, error_message: str) -> None:
    supabase.table("event_outbox_failed").insert(
        {
            "outbox_id": item["id"],
            "event_id": item.get("event_id"),
            "event_type": item.get("event_type"),
            "payload": item.get("payload") or {},
            "agency_id": item.get("agency_id"),
            "lead_id": item.get("lead_id"),
            "retry_count": int(item.get("retry_count") or 0),
            "error_message": error_message,
            "failed_at": _now_iso(),
        }
    ).execute()


def get_pending_outbox(limit: int = 100) -> list[dict]:
    now_iso = _now_iso()
    result = (
        supabase.table("event_outbox")
        .select("id,event_id,event_type,payload,retry_count,max_attempts,agency_id,lead_id,next_retry_at")
        .eq("status", "pending")
        .or_(f"next_retry_at.is.null,next_retry_at.lte.{now_iso}")
        .order("next_retry_at", desc=False)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return result.data or []
