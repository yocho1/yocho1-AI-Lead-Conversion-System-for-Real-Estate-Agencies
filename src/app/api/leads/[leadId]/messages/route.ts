import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const agencyApiKey = searchParams.get("agencyApiKey");

  if (!agencyApiKey) {
    return NextResponse.json({ error: "Missing agencyApiKey" }, { status: 400 });
  }

  const { leadId } = await params;
  const supabase = getServerSupabase();

  const { data: agency } = await supabase.from("agencies").select("id").eq("api_key", agencyApiKey).single();
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agency.id).single();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, role, content, timestamp")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  return NextResponse.json({ messages: messages || [] });
}
