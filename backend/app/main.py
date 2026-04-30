import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException

from .booking_engine import BookingStorageNotInitializedError, create_booking, get_available_slots
from .channel_router import route_message
from .events import emit_event
from .models import BookingRequest, LeadCreateRequest
from .normalization import (
    compute_status,
    normalize_budget,
    normalize_location,
    normalize_name,
    normalize_phone,
    normalize_timeline,
)
from .supabase_client import get_supabase

app = FastAPI(title="Lead Conversion Event API", version="1.0.0")
supabase = get_supabase()


def fetch_lead_contact(lead_id: str) -> dict | None:
    try:
        result = (
            supabase.table("leads")
            .select("id,name,phone,email,preferred_channel")
            .eq("id", lead_id)
            .limit(1)
            .execute()
        )
    except Exception:  # noqa: BLE001
        return None

    rows = result.data or []
    return rows[0] if rows else None


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.get("/available-slots")
def available_slots(agent_id: str, date: str) -> dict:
    try:
        target_date = datetime.fromisoformat(date).date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD") from exc

    try:
        slots = get_available_slots(agent_id=agent_id, target_date=target_date)
    except BookingStorageNotInitializedError:
        return {
            "agent_id": agent_id,
            "date": target_date.isoformat(),
            "slots": [],
            "configured": False,
            "message": "Booking tables are not initialized in Supabase.",
        }

    return {
        "agent_id": agent_id,
        "date": target_date.isoformat(),
        "slots": slots,
        "configured": True,
    }


@app.post("/book")
def book_visit(payload: BookingRequest) -> dict:
    booking = create_booking(
        lead_id=payload.lead_id,
        agent_id=payload.agent_id,
        slot_datetime=payload.datetime,
        status=payload.status,
    )

    if booking is None:
        raise HTTPException(status_code=409, detail="Selected slot is already booked")

    lead = fetch_lead_contact(payload.lead_id)
    if not lead:
        return {
            "booking": booking,
            "delivery": {"status": "skipped", "message": "Lead contact not found"},
        }

    recipient = lead.get("phone") or lead.get("email")
    if not recipient:
        return {
            "booking": booking,
            "delivery": {"status": "skipped", "message": "Lead has no contact channel"},
        }

    confirmation_message = (
        f"Visit confirmed for {payload.datetime.astimezone(timezone.utc).isoformat()} with agent {payload.agent_id}."
    )
    delivery = asyncio.run(
        route_message(
            lead=lead,
            to=str(recipient),
            content=confirmation_message,
            metadata={"event_type": "booking.confirmed", "booking_id": booking.get("id")},
        )
    )

    return {
        "booking": booking,
        "delivery": {
            "status": delivery.status,
            "channel": delivery.channel,
            "ok": delivery.ok,
        },
    }


@app.post(
    "/v1/leads",
    responses={
        400: {
            "description": "Invalid payload values",
        }
    },
)
def create_lead(payload: LeadCreateRequest) -> dict:
    try:
        name = normalize_name(payload.name)
        budget = normalize_budget(payload.budget)
        location = normalize_location(
            payload.location.raw if payload.location else None,
            payload.location.city if payload.location else None,
            payload.location.country if payload.location else None,
        )
        timeline_raw, timeline_normalized = normalize_timeline(payload.timeline)
        has_contact = bool(payload.email or payload.phone)
        status = compute_status(budget, has_contact, timeline_normalized)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    record = {
        "agency_id": payload.agency_id,
        "name": name,
        "email": payload.email,
        "phone": normalize_phone(payload.phone),
        "budget": budget,
        "currency": payload.currency or "USD",
        "location": location,
        "property_type": payload.property_type,
        "timeline": timeline_raw,
        "timeline_normalized": timeline_normalized,
        "preferred_channel": payload.preferred_channel,
        "delivery_status": "pending",
        "status": status,
        "whatsapp_sent": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    dedupe_value = payload.email or normalize_phone(payload.phone)

    if payload.email:
        existing = (
            supabase.table("leads")
            .select("id")
            .eq("agency_id", payload.agency_id)
            .eq("email", payload.email)
            .limit(1)
            .execute()
        )
    else:
        existing = (
            supabase.table("leads")
            .select("id")
            .eq("agency_id", payload.agency_id)
            .eq("phone", dedupe_value)
            .limit(1)
            .execute()
        )

    if existing.data:
        lead_id = existing.data[0]["id"]
        (
            supabase.table("leads")
            .update(record)
            .eq("id", lead_id)
            .eq("agency_id", payload.agency_id)
            .execute()
        )
        event_type = "lead.updated"
    else:
        inserted = supabase.table("leads").insert(record).execute()
        lead_id = inserted.data[0]["id"]
        event_type = "lead.created"

    emitted_events: list[str] = []
    emitted_events.append(
        emit_event(event_type, {"lead_id": lead_id, "agency_id": payload.agency_id}, max_attempts=6)
    )

    if status == "hot":
        emitted_events.append(
            emit_event("lead.hot", {"lead_id": lead_id, "agency_id": payload.agency_id}, max_attempts=6)
        )

    return {"id": lead_id, "status": status, "queued": True, "event_ids": emitted_events}
