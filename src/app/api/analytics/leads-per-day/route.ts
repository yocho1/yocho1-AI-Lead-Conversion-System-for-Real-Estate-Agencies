import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const { data: leads } = await supabase.from("leads").select("created_at").eq("agency_id", agencyContext.agencyId);
  const totals = new Map<string, number>();

  for (const lead of leads || []) {
    const day = new Date(lead.created_at).toISOString().slice(0, 10);
    totals.set(day, (totals.get(day) || 0) + 1);
  }

  return NextResponse.json({
    series: Array.from(totals.entries()).map(([day, count]) => ({ day, count })),
  });
}
