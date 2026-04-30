import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

const STAGES = [
  "NEW_LEAD",
  "QUALIFIED",
  "VISIT_SCHEDULED",
  "NEGOTIATION",
  "OFFER_MADE",
  "CLOSED",
  "LOST",
] as const;

function isMissingDealsSchemaError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("deals")
    && (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
}

function emptySummary() {
  return {
    total_deals: 0,
    total_pipeline_value: 0,
    closed_revenue: 0,
    conversion_rate: 0,
    expected_revenue: 0,
    by_stage: Object.fromEntries(STAGES.map((stage) => [stage, 0])),
    stage_value_totals: Object.fromEntries(STAGES.map((stage) => [stage, 0])),
  };
}

function mapLeadToInitialDealStage(lead: {
  status?: string | null;
  appointment_status?: string | null;
  lead_state?: { stage?: string | null } | null;
}) {
  // Always start auto-seeded leads at NEW_LEAD so teams can triage from the first column.
  void lead;
  return "NEW_LEAD";
}

async function ensureDealsForExistingLeads(
  supabase: ReturnType<typeof getServerSupabase>,
  agencyId: string,
) {
  const [leadsResult, dealsResult] = await Promise.all([
    supabase
      .from("leads")
      .select("id,budget_value,status,appointment_status,lead_state")
      .eq("agency_id", agencyId),
    supabase
      .from("deals")
      .select("id,lead_id")
      .eq("agency_id", agencyId),
  ]);

  if (leadsResult.error || dealsResult.error) {
    return;
  }

  const leads = leadsResult.data || [];
  const deals = dealsResult.data || [];
  const leadIdsWithDeals = new Set(deals.map((deal) => deal.lead_id).filter(Boolean));
  const missingLeads = leads.filter((lead) => !leadIdsWithDeals.has(lead.id));

  if (missingLeads.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const inserts = missingLeads.map((lead) => ({
    agency_id: agencyId,
    lead_id: lead.id,
    stage: mapLeadToInitialDealStage(lead),
    deal_value: lead.budget_value,
    created_at: now,
    updated_at: now,
  }));

  await supabase.from("deals").insert(inserts);
}

export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  await ensureDealsForExistingLeads(supabase, agencyContext.agencyId);

  const result = await supabase
    .from("deals")
    .select("id,stage,deal_value,assigned_agent_id")
    .eq("agency_id", agencyContext.agencyId)
    ;

  if (result.error) {
    if (isMissingDealsSchemaError(result.error.message)) {
      return NextResponse.json(
        {
          configured: false,
          error: "Deals pipeline tables are not initialized in Supabase. Please run the latest schema migration.",
          ...emptySummary(),
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch summary" }, { status: 500 });
  }

  const deals = result.data || [];
  const totalDeals = deals.length;
  let totalPipelineValue = 0;
  let closedRevenue = 0;
  const byStage: Record<string, number> = Object.fromEntries(
    STAGES.map((stage) => [stage, 0])
  );
  const stageValueTotals: Record<string, number> = Object.fromEntries(
    STAGES.map((stage) => [stage, 0])
  );

  for (const deal of deals) {
    const stage = deal.stage || "NEW_LEAD";
    const value = Number(deal.deal_value || 0);

    byStage[stage] = (byStage[stage] || 0) + 1;
    stageValueTotals[stage] = Number(((stageValueTotals[stage] || 0) + value).toFixed(2));

    if (stage === "CLOSED") {
      closedRevenue += value;
    } else if (stage !== "LOST") {
      totalPipelineValue += value;
    }
  }

  const conversionRate = totalDeals > 0 ? (byStage.CLOSED / totalDeals) * 100 : 0;
  const expectedRevenue = closedRevenue + totalPipelineValue * 0.35;

  return NextResponse.json({
    configured: true,
    total_deals: totalDeals,
    total_pipeline_value: Number(totalPipelineValue.toFixed(2)),
    closed_revenue: Number(closedRevenue.toFixed(2)),
    conversion_rate: Number(conversionRate.toFixed(2)),
    expected_revenue: Number(expectedRevenue.toFixed(2)),
    by_stage: byStage,
    stage_value_totals: stageValueTotals,
  });
}

