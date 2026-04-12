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

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, email, phone, budget, location, property_type, buying_timeline, status, created_at")
    .eq("agency_id", agency.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load leads" }, { status: 500 });
  }

  return NextResponse.json({ leads: leads || [] });
}
