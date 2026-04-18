from datetime import datetime, timezone

from .supabase_client import get_supabase


supabase = get_supabase()


def log_event(
    agency_id: str,
    lead_id: str | None,
    event_type: str,
    status: str,
    message: str,
    attempt: int = 0,
    event_id: str | None = None,
) -> None:
    supabase.table("event_logs").insert(
        {
            "event_id": event_id,
            "agency_id": agency_id,
            "lead_id": lead_id,
            "event_type": event_type,
            "status": status,
            "message": message,
            "attempt": attempt,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
