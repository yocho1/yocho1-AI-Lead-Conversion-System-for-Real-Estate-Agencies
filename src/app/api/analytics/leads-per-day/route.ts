import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agencyApiKey = searchParams.get("agencyApiKey");

  if (!agencyApiKey) {
    return NextResponse.json({ error: "Missing agencyApiKey" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: agency } = await supabase.from("agencies").select("id").eq("api_key", agencyApiKey).single();
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  const { data: leads } = await supabase.from("leads").select("created_at").eq("agency_id", agency.id);
  const totals = new Map<string, number>();

  for (const lead of leads || []) {
    const day = new Date(lead.created_at).toISOString().slice(0, 10);
    totals.set(day, (totals.get(day) || 0) + 1);
  }

  return NextResponse.json({
    series: Array.from(totals.entries()).map(([day, count]) => ({ day, count })),
  });
}
