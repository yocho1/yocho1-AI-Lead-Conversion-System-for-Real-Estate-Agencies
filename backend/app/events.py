from .logging_store import log_event
from .event_store import create_or_get_event
from .outbox import mark_outbox_failed, mark_outbox_success, save_outbox_event
from .queue import enqueue_event


def emit_event(event_type: str, payload: dict, max_attempts: int = 6, delay_seconds: int = 0) -> str:
    agency_id = str(payload.get("agency_id", ""))
    lead_id = payload.get("lead_id")
    event_id, created = create_or_get_event(event_type, payload, max_attempts=max_attempts)
    if not created:
        log_event(agency_id, lead_id, event_type, "duplicate", "Existing event reused", event_id=event_id)
        return event_id

    outbox_id = save_outbox_event(event_id, event_type, payload, agency_id, lead_id, max_attempts)
    try:
        enqueue_event(event_id, event_type, payload, delay_seconds=delay_seconds)
        mark_outbox_success(outbox_id)
        queue_note = "Event queued" if delay_seconds <= 0 else f"Event delayed by {delay_seconds}s"
        log_event(agency_id, lead_id, event_type, "queued", queue_note, event_id=event_id)
    except Exception as exc:  # noqa: BLE001
        mark_outbox_failed(outbox_id, 1, str(exc))
        log_event(agency_id, lead_id, event_type, "error", str(exc), 1, event_id=event_id)
        raise

    return event_id
