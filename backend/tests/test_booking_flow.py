import os
from datetime import datetime, timezone
from types import SimpleNamespace

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature")

from fastapi.testclient import TestClient

from backend.app import main


def test_get_available_slots_endpoint(monkeypatch) -> None:
    def fake_get_available_slots(agent_id: str, target_date):
        assert agent_id == "agent-1"
        return ["2026-04-22T09:00:00+00:00", "2026-04-22T09:30:00+00:00"]

    monkeypatch.setattr(main, "get_available_slots", fake_get_available_slots)

    client = TestClient(main.app)
    response = client.get("/available-slots", params={"agent_id": "agent-1", "date": "2026-04-22"})

    assert response.status_code == 200
    body = response.json()
    assert body["slots"] == ["2026-04-22T09:00:00+00:00", "2026-04-22T09:30:00+00:00"]


def test_book_slot_and_send_confirmation(monkeypatch) -> None:
    booked_payload = {
        "id": "booking-1",
        "lead_id": "lead-1",
        "agent_id": "agent-1",
        "datetime": "2026-04-22T09:00:00+00:00",
        "status": "confirmed",
    }

    def fake_create_booking(lead_id: str, agent_id: str, slot_datetime: datetime, status: str):
        assert lead_id == "lead-1"
        assert agent_id == "agent-1"
        assert status == "confirmed"
        return booked_payload

    def fake_fetch_lead_contact(lead_id: str):
        return {
            "id": lead_id,
            "name": "Test Lead",
            "phone": "+212611223344",
            "email": "lead@example.com",
            "preferred_channel": "whatsapp",
        }

    async def fake_route_message(lead, to, content, metadata=None):
        assert "confirmed" in content.lower()
        assert to == "+212611223344"
        return SimpleNamespace(ok=True, channel="whatsapp", status="sent", attempts=[])

    monkeypatch.setattr(main, "create_booking", fake_create_booking)
    monkeypatch.setattr(main, "fetch_lead_contact", fake_fetch_lead_contact)
    monkeypatch.setattr(main, "route_message", fake_route_message)

    client = TestClient(main.app)
    response = client.post(
        "/book",
        json={
            "lead_id": "lead-1",
            "agent_id": "agent-1",
            "datetime": "2026-04-22T09:00:00Z",
            "status": "confirmed",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["booking"]["id"] == "booking-1"
    assert body["delivery"]["status"] == "sent"


def test_prevent_double_booking(monkeypatch) -> None:
    def fake_create_booking(lead_id: str, agent_id: str, slot_datetime: datetime, status: str):
        return None

    monkeypatch.setattr(main, "create_booking", fake_create_booking)

    client = TestClient(main.app)
    response = client.post(
        "/book",
        json={
            "lead_id": "lead-1",
            "agent_id": "agent-1",
            "datetime": "2026-04-22T09:00:00Z",
            "status": "confirmed",
        },
    )

    assert response.status_code == 409
    assert "already booked" in response.json()["detail"].lower()
