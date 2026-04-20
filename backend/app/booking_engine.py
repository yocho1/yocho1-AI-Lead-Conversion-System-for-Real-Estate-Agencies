from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from postgrest.exceptions import APIError

from .supabase_client import get_supabase

supabase = get_supabase()

ACTIVE_BOOKING_STATUSES = {"pending", "confirmed"}


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_slot(value: datetime) -> datetime:
    # Bookings are treated at minute granularity to avoid second-level duplicates.
    return _ensure_utc(value).replace(second=0, microsecond=0)


def _date_range_bounds(target_date: date) -> tuple[str, str]:
    start = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end = datetime.combine(target_date, time.max, tzinfo=timezone.utc)
    return start.isoformat(), end.isoformat()


def _slot_step_minutes(row: dict[str, Any]) -> int:
    raw = row.get("slot_minutes")
    if isinstance(raw, int) and raw > 0:
        return raw
    return 30


def _parse_time(value: str) -> time:
    return time.fromisoformat(value)


def _is_missing_table_error(error: Exception, table_name: str) -> bool:
    if not isinstance(error, APIError):
        return False
    message = str(error).lower()
    return "pgrst205" in message and table_name.lower() in message


def _fetch_agent_availability(agent_id: str, weekday: int) -> list[dict[str, Any]]:
    try:
        result = (
            supabase.table("agent_availability")
            .select("agent_id,weekday,start_time,end_time,slot_minutes,active")
            .eq("agent_id", agent_id)
            .eq("weekday", weekday)
            .eq("active", True)
            .execute()
        )
        return result.data or []
    except Exception as exc:  # noqa: BLE001
        if _is_missing_table_error(exc, "agent_availability"):
            return []
        raise


def _fetch_bookings(agent_id: str, target_date: date) -> list[dict[str, Any]]:
    start_iso, end_iso = _date_range_bounds(target_date)
    try:
        result = (
            supabase.table("bookings")
            .select("id,agent_id,datetime,status")
            .eq("agent_id", agent_id)
            .in_("status", list(ACTIVE_BOOKING_STATUSES))
            .gte("datetime", start_iso)
            .lte("datetime", end_iso)
            .execute()
        )
        return result.data or []
    except Exception as exc:  # noqa: BLE001
        if _is_missing_table_error(exc, "bookings"):
            return []
        raise


def get_available_slots(
    agent_id: str,
    target_date: date,
    availability_rows: list[dict[str, Any]] | None = None,
    booking_rows: list[dict[str, Any]] | None = None,
) -> list[str]:
    rows = availability_rows if availability_rows is not None else _fetch_agent_availability(agent_id, target_date.weekday())
    bookings = booking_rows if booking_rows is not None else _fetch_bookings(agent_id, target_date)

    taken = {
        _normalize_slot(datetime.fromisoformat(str(item.get("datetime") or "")))
        for item in bookings
        if str(item.get("status") or "").lower() in ACTIVE_BOOKING_STATUSES and item.get("datetime")
    }

    slots: list[datetime] = []
    for row in rows:
        if not row.get("active", True):
            continue

        start_at = datetime.combine(target_date, _parse_time(str(row.get("start_time"))), tzinfo=timezone.utc)
        end_at = datetime.combine(target_date, _parse_time(str(row.get("end_time"))), tzinfo=timezone.utc)
        step = timedelta(minutes=_slot_step_minutes(row))

        cursor = start_at
        while cursor + step <= end_at:
            normalized = _normalize_slot(cursor)
            if normalized not in taken:
                slots.append(normalized)
            cursor += step

    slots.sort()
    return [slot.isoformat() for slot in slots]


def create_booking(lead_id: str, agent_id: str, slot_datetime: datetime, status: str = "confirmed") -> dict[str, Any] | None:
    slot_utc = _normalize_slot(slot_datetime)

    try:
        existing = (
            supabase.table("bookings")
            .select("id")
            .eq("agent_id", agent_id)
            .eq("datetime", slot_utc.isoformat())
            .in_("status", list(ACTIVE_BOOKING_STATUSES))
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        if _is_missing_table_error(exc, "bookings"):
            return None
        raise

    if existing.data:
        return None

    payload = {
        "lead_id": lead_id,
        "agent_id": agent_id,
        "datetime": slot_utc.isoformat(),
        "status": status,
    }

    try:
        inserted = supabase.table("bookings").insert(payload).execute()
    except Exception as exc:  # noqa: BLE001
        if _is_missing_table_error(exc, "bookings"):
            return None
        return None

    return (inserted.data or [None])[0]


def suggest_available_times(agent_id: str | None = None, days_ahead: int = 3) -> str:
    target_agent = (agent_id or "").strip()

    if not target_agent:
        try:
            result = supabase.table("agent_availability").select("agent_id").eq("active", True).limit(1).execute()
            first = (result.data or [None])[0]
            target_agent = str((first or {}).get("agent_id") or "").strip()
        except Exception as exc:  # noqa: BLE001
            if _is_missing_table_error(exc, "agent_availability"):
                return "No available slots are configured yet."
            raise

    if not target_agent:
        return "No available slots are configured yet."

    for offset in range(days_ahead):
        day = datetime.now(timezone.utc).date() + timedelta(days=offset)
        slots = get_available_slots(target_agent, day)
        if slots:
            top_three = ", ".join(slots[:3])
            return f"Available visit times: {top_three}."

    return "No available slots in the next few days."
