from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException

from .events import emit_event
from .models import LeadCreateRequest
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


@app.get("/health")
def health() -> dict:
    return {"ok": True}


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
