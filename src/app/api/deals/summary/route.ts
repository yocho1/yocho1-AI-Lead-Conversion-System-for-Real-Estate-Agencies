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

export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const result = await supabase
    .from("deals")
    .select("id,stage,deal_value,assigned_agent_id")
    .eq("agency_id", agencyContext.agencyId)
    .execute();

  if (result.error) {
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
    total_deals: totalDeals,
    total_pipeline_value: Number(totalPipelineValue.toFixed(2)),
    closed_revenue: Number(closedRevenue.toFixed(2)),
    conversion_rate: Number(conversionRate.toFixed(2)),
    expected_revenue: Number(expectedRevenue.toFixed(2)),
    by_stage: byStage,
    stage_value_totals: stageValueTotals,
  });
}
