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

function emptyPipeline() {
  return Object.fromEntries(STAGES.map((stage) => [stage, []]));
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
    .select("id,lead_id,stage,deal_value,commission_rate,assigned_agent_id,created_at,updated_at")
    .eq("agency_id", agencyContext.agencyId)
    .order("updated_at", { ascending: false });

  if (result.error) {
    if (isMissingDealsSchemaError(result.error.message)) {
      return NextResponse.json(
        {
          configured: false,
          error: "Deals pipeline tables are not initialized in Supabase. Please run the latest schema migration.",
          pipeline: emptyPipeline(),
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: "Failed to fetch pipeline" }, { status: 500 });
  }

  const deals = result.data || [];
  const leadIds = [...new Set(deals.map((deal) => deal.lead_id).filter(Boolean))];

  let leadById = new Map<string, Record<string, unknown>>();
  if (leadIds.length > 0) {
    const leadResult = await supabase
      .from("leads")
      .select("id,name,email,phone,budget,budget_value,location,location_city,property_type,buying_timeline")
      .in("id", leadIds);

    if (leadResult.error) {
      if (isMissingDealsSchemaError(leadResult.error.message)) {
        return NextResponse.json(
          {
            configured: false,
            error: "Deals pipeline tables are not initialized in Supabase. Please run the latest schema migration.",
            pipeline: emptyPipeline(),
          },
          { status: 200 }
        );
      }

      leadById = new Map<string, Record<string, unknown>>();
    } else {
      leadById = new Map(
        (leadResult.data || []).map((lead) => [lead.id as string, lead as Record<string, unknown>])
      );
    }
  }

  const grouped: Record<string, unknown[]> = emptyPipeline();

  for (const deal of deals) {
    const stage = deal.stage || "NEW_LEAD";
    if (!grouped[stage]) {
      grouped[stage] = [];
    }

    grouped[stage].push({
      ...deal,
      lead: deal.lead_id ? leadById.get(deal.lead_id) || null : null,
    });
  }

  return NextResponse.json({ configured: true, pipeline: grouped });
}

