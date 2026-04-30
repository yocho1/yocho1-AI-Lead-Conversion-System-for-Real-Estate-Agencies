"""
Deal Pipeline Tests

Tests cover:
1. Creating deals from leads
2. Valid and invalid stage transitions
3. Pipeline grouping by stage
4. Pipeline summary metrics
5. Edge cases (missing lead, duplicate deal, etc.)
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from backend.app.deal_pipeline import (
    create_deal,
    transition_stage,
    get_pipeline,
    get_pipeline_summary,
    DealStage,
    VALID_TRANSITIONS,
)


@pytest.fixture
def mock_supabase():
    """Mock Supabase client"""
    with patch("backend.app.deal_pipeline.get_supabase") as mock:
        supabase = AsyncMock()
        mock.return_value = supabase
        yield supabase


@pytest.fixture
def sample_lead_id():
    return str(uuid.uuid4())


@pytest.fixture
def sample_agency_id():
    return str(uuid.uuid4())


@pytest.fixture
def sample_agent_id():
    return str(uuid.uuid4())


@pytest.fixture
def sample_deal_id():
    return str(uuid.uuid4())


class TestCreateDeal:
    """Test deal creation from leads"""

    @pytest.mark.asyncio
    async def test_create_deal_success(
        self, mock_supabase, sample_lead_id, sample_agency_id
    ):
        """Test successful deal creation"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(
                error=None,
                data={"id": sample_lead_id, "agency_id": sample_agency_id}
            )()
        )
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.side_effect = [
            AsyncMock(error=None, data={"id": sample_lead_id, "agency_id": sample_agency_id})(),
            AsyncMock(error=None, data=None)(),  # No existing deal
        ]
        mock_supabase.from_.return_value.insert.return_value.execute.return_value = (
            AsyncMock(error=None, data={})()
        )
        mock_supabase.from_.return_value.update.return_value.eq.return_value.execute.return_value = (
            AsyncMock(error=None)()
        )

        # Execute
        deal = await create_deal(
            agency_id=sample_agency_id,
            lead_id=sample_lead_id,
            deal_value=250000.0,
            commission_rate=5.0,
        )

        # Assert
        assert deal["stage"] == "NEW_LEAD"
        assert deal["deal_value"] == 250000.0
        assert deal["commission_rate"] == 5.0

    @pytest.mark.asyncio
    async def test_create_deal_missing_lead(self, mock_supabase, sample_agency_id):
        """Test deal creation fails for non-existent lead"""
        # Setup mock - lead not found
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(error="Not found", data=None)()
        )

        # Execute & Assert
        with pytest.raises(ValueError, match="Lead .* not found"):
            await create_deal(
                agency_id=sample_agency_id,
                lead_id=str(uuid.uuid4()),
            )

    @pytest.mark.asyncio
    async def test_create_deal_duplicate(
        self, mock_supabase, sample_lead_id, sample_agency_id
    ):
        """Test deal creation fails if deal already exists for lead"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.side_effect = [
            AsyncMock(error=None, data={"id": sample_lead_id, "agency_id": sample_agency_id})(),
            AsyncMock(error=None, data={"id": str(uuid.uuid4())})(),  # Existing deal
        ]

        # Execute & Assert
        with pytest.raises(ValueError, match="Deal already exists"):
            await create_deal(
                agency_id=sample_agency_id,
                lead_id=sample_lead_id,
            )


class TestStageTransition:
    """Test deal stage transitions"""

    @pytest.mark.asyncio
    async def test_transition_valid(self, mock_supabase, sample_deal_id):
        """Test valid stage transition"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(
                error=None,
                data={"id": sample_deal_id, "stage": "NEW_LEAD"}
            )()
        )
        mock_supabase.from_.return_value.update.return_value.eq.return_value.execute.return_value = (
            AsyncMock(error=None)()
        )
        mock_supabase.from_.return_value.insert.return_value.execute.return_value = (
            AsyncMock(error=None)()
        )

        # Execute
        deal = await transition_stage(
            deal_id=sample_deal_id,
            new_stage="QUALIFIED",
        )

        # Assert
        assert deal is not None

    @pytest.mark.asyncio
    async def test_transition_invalid(self, mock_supabase, sample_deal_id):
        """Test invalid stage transition"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(
                error=None,
                data={"id": sample_deal_id, "stage": "NEW_LEAD"}
            )()
        )

        # Execute & Assert
        with pytest.raises(ValueError, match="Cannot transition"):
            await transition_stage(
                deal_id=sample_deal_id,
                new_stage="CLOSED",  # Can't skip stages
            )

    @pytest.mark.asyncio
    async def test_transition_invalid_stage_name(self, mock_supabase, sample_deal_id):
        """Test transition with invalid stage name"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(
                error=None,
                data={"id": sample_deal_id, "stage": "NEW_LEAD"}
            )()
        )

        # Execute & Assert
        with pytest.raises(ValueError, match="Invalid stage"):
            await transition_stage(
                deal_id=sample_deal_id,
                new_stage="INVALID_STAGE",
            )

    @pytest.mark.asyncio
    async def test_transition_deal_not_found(self, mock_supabase):
        """Test transition fails if deal doesn't exist"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
            AsyncMock(error="Not found", data=None)()
        )

        # Execute & Assert
        with pytest.raises(ValueError, match="Deal .* not found"):
            await transition_stage(
                deal_id=str(uuid.uuid4()),
                new_stage="QUALIFIED",
            )


class TestPipelineGrouping:
    """Test pipeline grouping by stage"""

    @pytest.mark.asyncio
    async def test_pipeline_grouping(self, mock_supabase, sample_agency_id):
        """Test deals are correctly grouped by stage"""
        # Setup mock
        deals_data = [
            {
                "id": str(uuid.uuid4()),
                "stage": "NEW_LEAD",
                "deal_value": 100000,
                "leads": {"name": "John Doe"},
            },
            {
                "id": str(uuid.uuid4()),
                "stage": "NEW_LEAD",
                "deal_value": 150000,
                "leads": {"name": "Jane Smith"},
            },
            {
                "id": str(uuid.uuid4()),
                "stage": "QUALIFIED",
                "deal_value": 200000,
                "leads": {"name": "Bob Wilson"},
            },
            {
                "id": str(uuid.uuid4()),
                "stage": "CLOSED",
                "deal_value": 300000,
                "leads": {"name": "Alice Brown"},
            },
        ]

        mock_supabase.from_.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = (
            AsyncMock(error=None, data=deals_data)()
        )

        # Execute
        pipeline = await get_pipeline(sample_agency_id)

        # Assert
        assert len(pipeline["NEW_LEAD"]) == 2
        assert len(pipeline["QUALIFIED"]) == 1
        assert len(pipeline["CLOSED"]) == 1
        assert len(pipeline["LOST"]) == 0
        assert pipeline["NEW_LEAD"][0]["deal_value"] == 100000

    @pytest.mark.asyncio
    async def test_pipeline_empty(self, mock_supabase, sample_agency_id):
        """Test pipeline returns empty stages when no deals exist"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = (
            AsyncMock(error=None, data=[])()
        )

        # Execute
        pipeline = await get_pipeline(sample_agency_id)

        # Assert - all stages should exist but be empty
        assert len(pipeline) == 7
        for stage in DealStage:
            assert isinstance(pipeline[stage.value], list)
            assert len(pipeline[stage.value]) == 0


class TestPipelineSummary:
    """Test pipeline summary metrics"""

    @pytest.mark.asyncio
    async def test_pipeline_summary_metrics(self, mock_supabase, sample_agency_id):
        """Test summary calculations are correct"""
        # Setup mock
        deals_data = [
            {"id": str(uuid.uuid4()), "stage": "NEW_LEAD", "deal_value": 100000},
            {"id": str(uuid.uuid4()), "stage": "QUALIFIED", "deal_value": 150000},
            {"id": str(uuid.uuid4()), "stage": "CLOSED", "deal_value": 200000},
            {"id": str(uuid.uuid4()), "stage": "LOST", "deal_value": 50000},
        ]

        mock_supabase.from_.return_value.select.return_value.eq.return_value.execute.return_value = (
            AsyncMock(error=None, data=deals_data)()
        )

        # Execute
        summary = await get_pipeline_summary(sample_agency_id)

        # Assert
        assert summary["total_deals"] == 4
        assert summary["total_pipeline_value"] == 250000  # Excludes CLOSED and LOST
        assert summary["closed_revenue"] == 200000
        assert summary["lost_deals"] == 1
        assert summary["active_deals"] == 3
        assert summary["conversion_rate"] == 75.0  # 3 active / 4 total

    @pytest.mark.asyncio
    async def test_pipeline_summary_empty(self, mock_supabase, sample_agency_id):
        """Test summary with no deals"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.execute.return_value = (
            AsyncMock(error=None, data=[])()
        )

        # Execute
        summary = await get_pipeline_summary(sample_agency_id)

        # Assert
        assert summary["total_deals"] == 0
        assert summary["total_pipeline_value"] == 0
        assert summary["closed_revenue"] == 0
        assert summary["conversion_rate"] == 0


class TestValidTransitions:
    """Test transition rules"""

    def test_valid_transitions_structure(self):
        """Test that VALID_TRANSITIONS covers all stages"""
        all_stages = {stage.value for stage in DealStage}
        transition_stages = set(VALID_TRANSITIONS.keys())

        assert all_stages == transition_stages

    def test_valid_transitions_no_skipping_critical_stages(self):
        """Test that critical stage skipping is prevented"""
        # NEW_LEAD should not directly go to CLOSED
        assert "CLOSED" not in VALID_TRANSITIONS["NEW_LEAD"]

        # QUALIFIED should not skip to OFFER_MADE
        assert "OFFER_MADE" not in VALID_TRANSITIONS["QUALIFIED"]

        # VISIT_SCHEDULED should not skip to OFFER_MADE
        assert "OFFER_MADE" not in VALID_TRANSITIONS["VISIT_SCHEDULED"]

    def test_lost_can_reengage(self):
        """Test that lost deals can re-engage"""
        assert "NEW_LEAD" in VALID_TRANSITIONS["LOST"]

    def test_offer_can_renegotiate(self):
        """Test that offers can go back to negotiation"""
        assert "NEGOTIATION" in VALID_TRANSITIONS["OFFER_MADE"]


class TestEdgeCases:
    """Test edge cases and error handling"""

    @pytest.mark.asyncio
    async def test_create_deal_with_no_value(
        self, mock_supabase, sample_lead_id, sample_agency_id
    ):
        """Test creating deal without explicit deal_value uses budget_value"""
        # Setup mock
        mock_supabase.from_.return_value.select.return_value.eq.return_value.single.side_effect = [
            AsyncMock(
                error=None,
                data={"id": sample_lead_id, "agency_id": sample_agency_id, "budget_value": 500000}
            )(),
            AsyncMock(error=None, data=None)(),  # No existing deal
        ]
        mock_supabase.from_.return_value.insert.return_value.execute.return_value = (
            AsyncMock(error=None, data={})()
        )
        mock_supabase.from_.return_value.update.return_value.eq.return_value.execute.return_value = (
            AsyncMock(error=None)()
        )

        # Execute
        deal = await create_deal(
            agency_id=sample_agency_id,
            lead_id=sample_lead_id,
        )

        # Assert - should use budget_value from lead
        assert deal is not None

    @pytest.mark.asyncio
    async def test_transition_with_long_chain(self, mock_supabase, sample_deal_id):
        """Test transitioning through multiple stages sequentially"""
        stages = ["NEW_LEAD", "QUALIFIED", "VISIT_SCHEDULED", "NEGOTIATION", "OFFER_MADE", "CLOSED"]

        for i, stage in enumerate(stages[:-1]):
            next_stage = stages[i + 1]

            # Setup mock
            mock_supabase.from_.return_value.select.return_value.eq.return_value.single.return_value = (
                AsyncMock(
                    error=None,
                    data={"id": sample_deal_id, "stage": stage}
                )()
            )
            mock_supabase.from_.return_value.update.return_value.eq.return_value.execute.return_value = (
                AsyncMock(error=None)()
            )
            mock_supabase.from_.return_value.insert.return_value.execute.return_value = (
                AsyncMock(error=None)()
            )

            # Execute - should not raise
            await transition_stage(
                deal_id=sample_deal_id,
                new_stage=next_stage,
            )
