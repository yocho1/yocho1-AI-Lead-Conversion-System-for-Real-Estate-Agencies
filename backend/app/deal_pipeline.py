"""
Deal Pipeline service for managing lead-to-deal conversions.
Handles deal creation, stage transitions, pipeline aggregation, and metrics.
"""

import logging
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from .supabase_client import get_supabase

logger = logging.getLogger(__name__)


class DealStage(str, Enum):
    NEW_LEAD = "NEW_LEAD"
    QUALIFIED = "QUALIFIED"
    VISIT_SCHEDULED = "VISIT_SCHEDULED"
    NEGOTIATION = "NEGOTIATION"
    OFFER_MADE = "OFFER_MADE"
    CLOSED = "CLOSED"
    LOST = "LOST"


VALID_TRANSITIONS: Dict[DealStage, List[DealStage]] = {
    DealStage.NEW_LEAD: [DealStage.QUALIFIED, DealStage.LOST],
    DealStage.QUALIFIED: [DealStage.VISIT_SCHEDULED, DealStage.NEGOTIATION, DealStage.LOST],
    DealStage.VISIT_SCHEDULED: [DealStage.NEGOTIATION, DealStage.LOST],
    DealStage.NEGOTIATION: [DealStage.OFFER_MADE, DealStage.LOST],
    DealStage.OFFER_MADE: [DealStage.CLOSED, DealStage.NEGOTIATION, DealStage.LOST],
    DealStage.CLOSED: [DealStage.LOST],
    DealStage.LOST: [DealStage.NEW_LEAD],
}


def create_deal(
    agency_id: str,
    lead_id: str,
    deal_value: Optional[float] = None,
    commission_rate: Optional[float] = None,
    assigned_agent_id: Optional[str] = None,
) -> Dict[str, Any]:
    supabase = get_supabase()

    lead_result = (
        supabase.table("leads")
        .select("id,agency_id,budget_value")
        .eq("id", lead_id)
        .eq("agency_id", agency_id)
        .limit(1)
        .execute()
    )
    lead_data = (lead_result.data or [None])[0]
    if not lead_data:
        raise ValueError(f"Lead {lead_id} not found or not accessible")

    existing_deal = (
        supabase.table("deals").select("id").eq("lead_id", lead_id).limit(1).execute()
    )
    if existing_deal.data:
        raise ValueError(f"Deal already exists for lead {lead_id}")

    now_iso = datetime.utcnow().isoformat()
    deal_id = str(uuid.uuid4())
    deal_data = {
        "id": deal_id,
        "agency_id": agency_id,
        "lead_id": lead_id,
        "stage": DealStage.NEW_LEAD.value,
        "deal_value": deal_value if deal_value is not None else lead_data.get("budget_value"),
        "commission_rate": commission_rate,
        "assigned_agent_id": assigned_agent_id,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    insert_result = supabase.table("deals").insert(deal_data).execute()
    if insert_result.error:
        raise ValueError(f"Failed to create deal: {insert_result.error}")

    supabase.table("leads").update({"deal_id": deal_id}).eq("id", lead_id).execute()
    return deal_data


def transition_stage(
    deal_id: str,
    new_stage: str,
    changed_by: Optional[str] = None,
) -> Dict[str, Any]:
    supabase = get_supabase()

    try:
        target_stage = DealStage[new_stage]
    except KeyError as exc:
        raise ValueError(
            f"Invalid stage: {new_stage}. Valid stages: {[s.value for s in DealStage]}"
        ) from exc

    deal_result = supabase.table("deals").select("*").eq("id", deal_id).limit(1).execute()
    current_deal = (deal_result.data or [None])[0]
    if not current_deal:
        raise ValueError(f"Deal {deal_id} not found")

    current_stage = DealStage[current_deal["stage"]]
    if target_stage not in VALID_TRANSITIONS[current_stage]:
        valid_stages = [stage.value for stage in VALID_TRANSITIONS[current_stage]]
        raise ValueError(
            f"Cannot transition from {current_stage.value} to {target_stage.value}. "
            f"Valid transitions: {valid_stages}"
        )

    now_iso = datetime.utcnow().isoformat()
    update_result = (
        supabase.table("deals")
        .update({"stage": target_stage.value, "updated_at": now_iso})
        .eq("id", deal_id)
        .execute()
    )
    if update_result.error:
        raise ValueError(f"Failed to update deal stage: {update_result.error}")

    supabase.table("deal_events").insert(
        {
            "id": str(uuid.uuid4()),
            "deal_id": deal_id,
            "from_stage": current_stage.value,
            "to_stage": target_stage.value,
            "changed_at": now_iso,
            "changed_by": changed_by,
        }
    ).execute()

    updated_deal_result = (
        supabase.table("deals").select("*").eq("id", deal_id).limit(1).execute()
    )
    return (updated_deal_result.data or [{}])[0]


def get_pipeline(agency_id: str) -> Dict[str, List[Dict[str, Any]]]:
    supabase = get_supabase()
    result = (
        supabase.table("deals")
        .select(
            "id,lead_id,stage,deal_value,commission_rate,assigned_agent_id,created_at,updated_at,"
            "leads(id,name,email,phone,budget,budget_value,location,location_city,property_type,buying_timeline)"
        )
        .eq("agency_id", agency_id)
        .order("updated_at", desc=True)
        .execute()
    )

    grouped = {stage.value: [] for stage in DealStage}
    if result.error:
        return grouped

    for deal in (result.data or []):
        grouped[deal.get("stage", DealStage.NEW_LEAD.value)].append(deal)
    return grouped


def get_pipeline_summary(agency_id: str) -> Dict[str, Any]:
    supabase = get_supabase()
    result = supabase.table("deals").select("id,stage,deal_value").eq("agency_id", agency_id).execute()

    if result.error:
        return {
            "total_deals": 0,
            "total_pipeline_value": 0.0,
            "closed_revenue": 0.0,
            "conversion_rate": 0.0,
            "by_stage": {stage.value: 0 for stage in DealStage},
        }

    deals = result.data or []
    total_deals = len(deals)
    total_pipeline_value = 0.0
    closed_revenue = 0.0
    stage_counts = {stage.value: 0 for stage in DealStage}
    stage_value_totals = {stage.value: 0.0 for stage in DealStage}

    for deal in deals:
        stage = deal.get("stage", DealStage.NEW_LEAD.value)
        value = float(deal.get("deal_value") or 0)
        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        stage_value_totals[stage] = round(stage_value_totals.get(stage, 0.0) + value, 2)
        if stage == DealStage.CLOSED.value:
            closed_revenue += value
        elif stage != DealStage.LOST.value:
            total_pipeline_value += value

    conversion_rate = (stage_counts[DealStage.CLOSED.value] / total_deals * 100) if total_deals else 0.0
    expected_revenue = closed_revenue + total_pipeline_value * 0.35

    return {
        "total_deals": total_deals,
        "total_pipeline_value": round(total_pipeline_value, 2),
        "closed_revenue": round(closed_revenue, 2),
        "conversion_rate": round(conversion_rate, 2),
        "expected_revenue": round(expected_revenue, 2),
        "by_stage": stage_counts,
        "stage_value_totals": stage_value_totals,
    }


def auto_create_deal_for_hot_lead(lead_id: str, agency_id: str) -> Optional[Dict[str, Any]]:
    try:
        return create_deal(agency_id=agency_id, lead_id=lead_id)
    except ValueError as exc:
        if "already exists" in str(exc):
            return None
        logger.warning("Auto-create deal failed for lead %s: %s", lead_id, exc)
        return None
