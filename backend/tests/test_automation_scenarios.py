import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature")

from backend.app import automation_engine
from backend.worker import processor


class _FakeTable:
    def __init__(self, table_name: str, state: dict):
        self.table_name = table_name
        self.state = state
        self._filters: dict[str, str] = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key: str, value):
        self._filters[key] = str(value)
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        if self.table_name == "automations":
            trigger = self._filters.get("trigger")
            agency_id = self._filters.get("agency_id")
            rows = [
                row
                for row in self.state["automations"]
                if str(row.get("trigger")) == trigger and str(row.get("agency_id")) == agency_id
            ]
            return type("Result", (), {"data": rows})

        if self.table_name == "leads":
            lead_id = self._filters.get("id")
            rows = [row for row in self.state["leads"] if str(row.get("id")) == lead_id]
            return type("Result", (), {"data": rows})

        return type("Result", (), {"data": []})


class _FakeSupabase:
    def __init__(self, state: dict):
        self.state = state

    def table(self, table_name: str):
        return _FakeTable(table_name, self.state)


def test_automation_rule_executes_for_hot_lead(monkeypatch) -> None:
    state = {
        "automations": [
            {
                "id": "auto-1",
                "agency_id": "agency-1",
                "trigger": "lead.created",
                "condition": '{"field":"lead.category","operator":"eq","value":"HOT"}',
                "action": '{"type":"send_whatsapp","message":"HOT lead arrived"}',
            }
        ],
        "leads": [
            {
                "id": "lead-1",
                "name": "Nadia",
                "phone": "+212600000001",
                "email": "nadia@example.com",
                "status": "hot",
                "lead_category": "HOT",
            }
        ],
    }

    monkeypatch.setattr(automation_engine, "get_supabase", lambda: _FakeSupabase(state))
    monkeypatch.setattr(automation_engine, "log_event", lambda *args, **kwargs: None)

    async def _fake_execute_send_whatsapp(lead: dict, message: str, event_type: str, automation_id: str):
        assert lead["id"] == "lead-1"
        assert message == "HOT lead arrived"
        assert event_type == "lead.created"
        assert automation_id == "auto-1"
        return {"ok": True, "status": "sent", "channel": "whatsapp"}

    monkeypatch.setattr(automation_engine, "_execute_send_whatsapp", _fake_execute_send_whatsapp)

    result = automation_engine.run_automations_for_event(
        "lead.created",
        {"agency_id": "agency-1", "lead_id": "lead-1"},
    )

    assert result["matched"] == 1
    assert result["executed"] == 1
    assert result["details"][0]["status"] == "sent"


def test_automation_rule_skips_when_condition_not_met(monkeypatch) -> None:
    state = {
        "automations": [
            {
                "id": "auto-2",
                "agency_id": "agency-1",
                "trigger": "lead.created",
                "condition": '{"field":"lead.category","operator":"eq","value":"HOT"}',
                "action": '{"type":"send_whatsapp","message":"HOT lead arrived"}',
            }
        ],
        "leads": [
            {
                "id": "lead-2",
                "name": "Khalid",
                "phone": "+212600000002",
                "email": "khalid@example.com",
                "status": "cold",
                "lead_category": "COLD",
            }
        ],
    }

    monkeypatch.setattr(automation_engine, "get_supabase", lambda: _FakeSupabase(state))

    result = automation_engine.run_automations_for_event(
        "lead.created",
        {"agency_id": "agency-1", "lead_id": "lead-2"},
    )

    assert result["matched"] == 1
    assert result["executed"] == 0
    assert result["details"][0]["status"] == "condition_not_met"


def test_worker_triggers_automation_on_lead_created(monkeypatch) -> None:
    calls = {"automation": 0, "decision": 0}

    monkeypatch.setattr(processor, "log_event", lambda *args, **kwargs: None)
    monkeypatch.setattr(processor, "event_already_processed", lambda event_id: False)
    monkeypatch.setattr(
        processor,
        "mark_event_processing",
        lambda event_id: {"id": event_id, "status": processor.EVENT_STATUS_PROCESSING, "attempts": 1, "max_attempts": 6},
    )
    monkeypatch.setattr(processor, "mark_event_status", lambda *args, **kwargs: None)
    monkeypatch.setattr(processor, "mark_success_and_log", lambda *args, **kwargs: None)

    def _fake_execute_automation_rules(event_type: str, payload: dict, event_id: str) -> None:
        calls["automation"] += 1
        assert event_type == "lead.created"
        assert payload["lead_id"] == "lead-3"
        assert event_id == "evt-automation-1"

    def _fake_evaluate_and_decide(*_args, **_kwargs) -> None:
        calls["decision"] += 1

    monkeypatch.setattr(processor, "execute_automation_rules", _fake_execute_automation_rules)
    monkeypatch.setattr(processor, "evaluate_and_decide", _fake_evaluate_and_decide)

    processor.process_event(
        {
            "event_id": "evt-automation-1",
            "type": "lead.created",
            "payload": {"agency_id": "agency-1", "lead_id": "lead-3"},
        }
    )

    assert calls["automation"] == 1
    assert calls["decision"] == 1
