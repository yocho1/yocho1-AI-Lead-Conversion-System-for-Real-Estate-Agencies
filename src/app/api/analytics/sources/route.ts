import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { computeSourceAnalytics, type SourceLeadRow } from "@/lib/source-analytics";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const daysParam = Number(searchParams.get("days") || "30");
  const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(Math.floor(daysParam), 365)) : 30;
  const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const { data, error } = await supabase
    .from("leads")
    .select("source,status,appointment_status,lead_state,created_at")
    .eq("agency_id", agencyContext.agencyId)
    .gte("created_at", start);

  if (error) {
    return NextResponse.json({ error: "Unable to load source analytics" }, { status: 500 });
  }

  const analytics = computeSourceAnalytics((data || []) as SourceLeadRow[]);

  return NextResponse.json({
    days,
    sources: analytics.items,
    totals: analytics.totals,
  });
}
