import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

const paramsSchema = z.object({
  agencyId: z.string().uuid(),
});

function generateApiKey() {
  return `ag_${randomBytes(18).toString("hex")}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agencyId: string }> },
) {
  const adminError = requireAdminAccess(request);
  if (adminError) return adminError;

  const resolvedParams = await params;
  const parsed = paramsSchema.safeParse(resolvedParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid agency id" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const nextApiKey = generateApiKey();

  const { data, error } = await supabase
    .from("agencies")
    .update({ api_key: nextApiKey })
    .eq("id", parsed.data.agencyId)
    .select("id,name,api_key,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to rotate API key" }, { status: 500 });
  }

  return NextResponse.json({ agency: data });
}
