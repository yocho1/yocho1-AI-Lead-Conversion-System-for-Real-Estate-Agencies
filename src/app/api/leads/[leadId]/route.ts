import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const agencyApiKey = searchParams.get("agencyApiKey");

  if (!agencyApiKey) {
    return NextResponse.json({ error: "Missing agencyApiKey" }, { status: 400 });
  }

  const { leadId } = await params;
  const parsed = paramsSchema.safeParse({ leadId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey) {
    const incomingAdminKey = request.headers.get("x-admin-key");
    if (!incomingAdminKey || incomingAdminKey !== adminKey) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const supabase = getServerSupabase();
  const { data: agency } = await supabase
    .from("agencies")
    .select("id")
    .eq("api_key", agencyApiKey)
    .single();

  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("agency_id", agency.id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", parsed.data.leadId)
    .eq("agency_id", agency.id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete lead" }, { status: 500 });
  }

  return NextResponse.json({ success: true, leadId: parsed.data.leadId });
}
