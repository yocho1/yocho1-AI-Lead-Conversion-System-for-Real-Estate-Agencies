import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess, requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await params;
  const parsed = paramsSchema.safeParse({ leadId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid lead id" }, { status: 400 });
  }

  const adminError = requireAdminAccess(request);
  if (adminError) return adminError;

  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("agency_id", agencyContext.agencyId)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", parsed.data.leadId)
    .eq("agency_id", agencyContext.agencyId);

  if (error) {
    return NextResponse.json({ error: "Unable to delete lead" }, { status: 500 });
  }

  return NextResponse.json({ success: true, leadId: parsed.data.leadId });
}
