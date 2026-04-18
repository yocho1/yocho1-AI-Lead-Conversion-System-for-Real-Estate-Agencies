import asyncio
import os
from types import SimpleNamespace

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature")

from backend.app.providers import ProviderResponse
from backend.worker import processor, retry_manager


def test_retry_backoff_sequence() -> None:
    assert retry_manager.get_retry_delay_seconds(1) == 30
    assert retry_manager.get_retry_delay_seconds(2) == 120
    assert retry_manager.get_retry_delay_seconds(3) == 600
    assert retry_manager.get_retry_delay_seconds(4) == 3600
    assert retry_manager.get_retry_delay_seconds(5) == 3600


def test_outbox_event_eventually_marked_failed(monkeypatch) -> None:
    item = {
        "id": "outbox-1",
        "event_id": "evt-1",
        "event_type": "lead.hot",
        "payload": {"agency_id": "agency-1", "lead_id": "lead-1"},
        "retry_count": 5,
        "agency_id": "agency-1",
        "lead_id": "lead-1",
    }
    calls = {"failed": 0, "moved": 0}

    monkeypatch.setattr(retry_manager, "get_pending_outbox", lambda limit=100: [item])

    def _raise_enqueue(event_id: str, event_type: str, payload: dict) -> None:
        raise RuntimeError("forced whatsapp api failure")

    monkeypatch.setattr(retry_manager, "enqueue_event", _raise_enqueue)
    monkeypatch.setattr(retry_manager, "mark_outbox_success", lambda outbox_id: None)
    monkeypatch.setattr(retry_manager, "mark_outbox_retry_pending", lambda *args, **kwargs: None)

    def _mark_failed(outbox_id: str, retry_count: int, last_error: str) -> None:
        calls["failed"] += 1
        assert retry_count == 6
        assert "forced whatsapp api failure" in last_error

    def _move_failed(row: dict, error_message: str) -> None:
        calls["moved"] += 1
        assert row["event_id"] == "evt-1"
        assert "forced whatsapp api failure" in error_message

    monkeypatch.setattr(retry_manager, "mark_outbox_failed", _mark_failed)
    monkeypatch.setattr(retry_manager, "move_outbox_to_failed_table", _move_failed)
    monkeypatch.setattr(retry_manager, "log_event", lambda *args, **kwargs: None)

    retry_manager.dispatch_outbox_once(limit=10)

    assert calls["failed"] == 1
    assert calls["moved"] == 1


def test_retry_delays_respected_on_failure(monkeypatch) -> None:
    item = {
        "id": "outbox-2",
        "event_id": "evt-2",
        "event_type": "lead.hot",
        "payload": {"agency_id": "agency-1", "lead_id": "lead-2"},
        "retry_count": 0,
        "agency_id": "agency-1",
        "lead_id": "lead-2",
    }
    captured: dict[str, int | str] = {}

    def _raise_enqueue(event_id: str, event_type: str, payload: dict) -> None:
        raise RuntimeError("forced whatsapp api failure")

    monkeypatch.setattr(retry_manager, "get_pending_outbox", lambda limit=100: [item])
    monkeypatch.setattr(retry_manager, "enqueue_event", _raise_enqueue)
    monkeypatch.setattr(retry_manager, "mark_outbox_success", lambda outbox_id: None)
    monkeypatch.setattr(retry_manager, "mark_outbox_failed", lambda *args, **kwargs: None)
    monkeypatch.setattr(retry_manager, "move_outbox_to_failed_table", lambda *args, **kwargs: None)

    def _mark_retry_pending(outbox_id: str, retry_count: int, next_retry_at: str, last_error: str) -> None:
        captured["retry_count"] = retry_count
        captured["next_retry_at"] = next_retry_at
        captured["last_error"] = last_error

    monkeypatch.setattr(retry_manager, "mark_outbox_retry_pending", _mark_retry_pending)
    monkeypatch.setattr(retry_manager, "log_event", lambda *args, **kwargs: None)

    retry_manager.dispatch_outbox_once(limit=1)

    assert captured["retry_count"] == 1
    assert isinstance(captured["next_retry_at"], str)
    assert "forced whatsapp api failure" in str(captured["last_error"])


def test_force_whatsapp_api_failure(monkeypatch) -> None:
    class FailingProvider:
        async def send(self, message: str, recipient: str) -> ProviderResponse:
            await asyncio.sleep(0)
            return ProviderResponse(ok=False, provider="whatsapp", message="forced whatsapp api failure")

    lead = {
        "id": "lead-9",
        "phone": "+212600000000",
        "email": None,
        "name": "Test Lead",
        "budget": "900000",
        "location": {"city": "Casablanca"},
        "timeline": "asap",
        "whatsapp_sent": False,
    }

    monkeypatch.setattr(processor, "resolve_provider", lambda channel, agency_id: FailingProvider())
    monkeypatch.setattr(processor, "enforce_per_tenant_rate_limit", lambda agency_id, channel: None)
    monkeypatch.setattr(processor, "log_event", lambda *args, **kwargs: None)

    deleted_keys: list[str] = []

    def _set(key: str, value: str, nx: bool, ex: int) -> bool:
        return True

    def _delete(key: str) -> int:
        deleted_keys.append(key)
        return 1

    fake_redis = SimpleNamespace(set=_set, delete=_delete)
    monkeypatch.setattr(processor, "redis_client", fake_redis)

    try:
        asyncio.run(processor.send_hot_lead_notification("agency-1", lead, "evt-force-fail"))
        assert False, "Expected RuntimeError for forced whatsapp failure"
    except RuntimeError as exc:
        assert "forced whatsapp api failure" in str(exc)

    assert deleted_keys == ["idempotency:whatsapp:evt-force-fail"]
