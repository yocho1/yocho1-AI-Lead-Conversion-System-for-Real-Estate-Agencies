from __future__ import annotations

from datetime import datetime, timedelta, timezone

from backend.app.logging_store import log_event
from backend.app.outbox import (
    get_pending_outbox,
    mark_outbox_failed,
    mark_outbox_retry_pending,
    mark_outbox_success,
    move_outbox_to_failed_table,
)
from backend.app.queue import enqueue_event


MAX_RETRIES = 5
_BACKOFF_SEQUENCE_SECONDS = [30, 120, 600, 3600]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_retry_delay_seconds(retry_count: int) -> int:
    if retry_count <= 0:
        return _BACKOFF_SEQUENCE_SECONDS[0]
    idx = min(retry_count - 1, len(_BACKOFF_SEQUENCE_SECONDS) - 1)
    return _BACKOFF_SEQUENCE_SECONDS[idx]


def next_retry_at_iso(retry_count: int, now: datetime | None = None) -> str:
    current = now or _now()
    return (current + timedelta(seconds=get_retry_delay_seconds(retry_count))).isoformat()


def should_move_to_failed(retry_count: int) -> bool:
    return retry_count > MAX_RETRIES


def _schedule_retry(
    outbox_id: str,
    retry_count: int,
    error_message: str,
    agency_id: str,
    lead_id: str | None,
    event_type: str,
    event_id: str | None = None,
) -> None:
    retry_at = next_retry_at_iso(retry_count)
    mark_outbox_retry_pending(outbox_id, retry_count, retry_at, error_message)
    delay_seconds = get_retry_delay_seconds(retry_count)
    log_event(
        agency_id,
        lead_id,
        event_type,
        "retrying",
        f"Outbox retry scheduled in {delay_seconds}s",
        retry_count,
        event_id=event_id,
    )


def _mark_dead_letter(item: dict, retry_count: int, error_message: str) -> None:
    outbox_id = item["id"]
    event_id = str(item.get("event_id") or "")
    event_type = str(item.get("event_type") or "")
    payload = item.get("payload") or {}
    agency_id = str(item.get("agency_id") or payload.get("agency_id") or "")
    lead_id = item.get("lead_id") or payload.get("lead_id")

    mark_outbox_failed(outbox_id, retry_count, error_message)
    move_outbox_to_failed_table(item, error_message)
    log_event(
        agency_id,
        lead_id,
        event_type,
        "dead_letter",
        "Outbox exceeded max retries",
        retry_count,
        event_id=event_id or None,
    )


def _process_missing_event_id(item: dict, retry_count: int) -> None:
    outbox_id = item["id"]
    event_type = str(item.get("event_type") or "")
    payload = item.get("payload") or {}
    agency_id = str(item.get("agency_id") or payload.get("agency_id") or "")
    lead_id = item.get("lead_id") or payload.get("lead_id")
    error_message = "missing event_id"

    if should_move_to_failed(retry_count):
        _mark_dead_letter(item, retry_count, error_message)
        return

    _schedule_retry(outbox_id, retry_count, error_message, agency_id, lead_id, event_type)


def _process_enqueue_failure(item: dict, retry_count: int, error_message: str) -> None:
    outbox_id = item["id"]
    event_id = str(item.get("event_id") or "")
    event_type = str(item.get("event_type") or "")
    payload = item.get("payload") or {}
    agency_id = str(item.get("agency_id") or payload.get("agency_id") or "")
    lead_id = item.get("lead_id") or payload.get("lead_id")

    if should_move_to_failed(retry_count):
        _mark_dead_letter(item, retry_count, error_message)
        return

    _schedule_retry(outbox_id, retry_count, error_message, agency_id, lead_id, event_type, event_id=event_id)


def dispatch_outbox_once(limit: int = 100) -> None:
    pending = get_pending_outbox(limit=limit)

    for item in pending:
        outbox_id = item["id"]
        event_id = str(item.get("event_id") or "")
        event_type = str(item.get("event_type") or "")
        payload = item.get("payload") or {}
        retry_count = int(item.get("retry_count") or 0)
        agency_id = str(item.get("agency_id") or payload.get("agency_id") or "")
        lead_id = item.get("lead_id") or payload.get("lead_id")

        if not event_id:
            _process_missing_event_id(item, retry_count + 1)
            continue

        try:
            enqueue_event(event_id, event_type, payload)
            mark_outbox_success(outbox_id)
            log_event(agency_id, lead_id, event_type, "queued", "Outbox dispatched", retry_count, event_id=event_id)
        except Exception as exc:  # noqa: BLE001
            _process_enqueue_failure(item, retry_count + 1, str(exc))
