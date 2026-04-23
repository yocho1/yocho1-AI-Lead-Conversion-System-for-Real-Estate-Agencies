import uuid
from unittest.mock import Mock, patch

import pytest

from backend.app.deal_pipeline import create_deal, get_pipeline, transition_stage


def _response(data=None, error=None):
    res = Mock()
    res.data = data
    res.error = error
    return res


def test_create_deal():
    agency_id = str(uuid.uuid4())
    lead_id = str(uuid.uuid4())

    with patch("backend.app.deal_pipeline.get_supabase") as mock_get:
        sb = Mock()
        mock_get.return_value = sb

        lead_table = Mock()
        lead_table.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = _response(
            data=[{"id": lead_id, "agency_id": agency_id, "budget_value": 500000}]
        )
        lead_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = _response(data=[])
        lead_table.update.return_value.eq.return_value.execute.return_value = _response(data=[])

        deals_table = Mock()
        deals_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = _response(data=[])
        deals_table.insert.return_value.execute.return_value = _response(data=[{"id": str(uuid.uuid4())}])

        sb.table.side_effect = lambda name: lead_table if name == "leads" else deals_table

        result = create_deal(agency_id=agency_id, lead_id=lead_id, deal_value=300000)

        assert result["stage"] == "NEW_LEAD"
        assert result["lead_id"] == lead_id
        assert result["agency_id"] == agency_id


def test_stage_transition_valid():
    deal_id = str(uuid.uuid4())

    with patch("backend.app.deal_pipeline.get_supabase") as mock_get:
        sb = Mock()
        mock_get.return_value = sb

        deals_table = Mock()
        deals_table.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            _response(data=[{"id": deal_id, "stage": "NEW_LEAD"}]),
            _response(data=[{"id": deal_id, "stage": "QUALIFIED"}]),
        ]
        deals_table.update.return_value.eq.return_value.execute.return_value = _response(data=[])

        events_table = Mock()
        events_table.insert.return_value.execute.return_value = _response(data=[])

        def table_router(name):
            if name == "deals":
                return deals_table
            if name == "deal_events":
                return events_table
            return Mock()

        sb.table.side_effect = table_router

        result = transition_stage(deal_id=deal_id, new_stage="QUALIFIED")
        assert result["stage"] == "QUALIFIED"


def test_stage_transition_invalid():
    deal_id = str(uuid.uuid4())

    with patch("backend.app.deal_pipeline.get_supabase") as mock_get:
        sb = Mock()
        mock_get.return_value = sb

        deals_table = Mock()
        deals_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = _response(
            data=[{"id": deal_id, "stage": "NEW_LEAD"}]
        )
        sb.table.return_value = deals_table

        with pytest.raises(ValueError, match="Cannot transition"):
            transition_stage(deal_id=deal_id, new_stage="CLOSED")


def test_pipeline_grouping():
    agency_id = str(uuid.uuid4())

    with patch("backend.app.deal_pipeline.get_supabase") as mock_get:
        sb = Mock()
        mock_get.return_value = sb

        deals_table = Mock()
        deals_table.select.return_value.eq.return_value.order.return_value.execute.return_value = _response(
            data=[
                {"id": str(uuid.uuid4()), "stage": "NEW_LEAD"},
                {"id": str(uuid.uuid4()), "stage": "NEW_LEAD"},
                {"id": str(uuid.uuid4()), "stage": "QUALIFIED"},
                {"id": str(uuid.uuid4()), "stage": "CLOSED"},
            ]
        )
        sb.table.return_value = deals_table

        pipeline = get_pipeline(agency_id=agency_id)

        assert len(pipeline["NEW_LEAD"]) == 2
        assert len(pipeline["QUALIFIED"]) == 1
        assert len(pipeline["CLOSED"]) == 1
        assert len(pipeline["LOST"]) == 0
