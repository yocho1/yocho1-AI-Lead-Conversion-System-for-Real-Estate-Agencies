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
    .select(
      "id,lead_id,stage,deal_value,commission_rate,assigned_agent_id,created_at,updated_at,leads(id,name,email,phone,budget,budget_value,location,location_city,property_type,buying_timeline)"
    )
    .eq("agency_id", agencyContext.agencyId)
    .order("updated_at", { ascending: false })
    .execute();

  if (result.error) {
    return NextResponse.json({ error: "Failed to fetch pipeline" }, { status: 500 });
  }

  const grouped: Record<string, unknown[]> = Object.fromEntries(
    STAGES.map((stage) => [stage, []])
  );

  for (const deal of result.data || []) {
    const stage = deal.stage || "NEW_LEAD";
    if (!grouped[stage]) {
      grouped[stage] = [];
    }
    grouped[stage].push(deal);
  }

  return NextResponse.json(grouped);
}
