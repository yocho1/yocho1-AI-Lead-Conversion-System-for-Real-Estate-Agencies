import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAccess } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

const createAgencySchema = z.object({
  name: z.string().min(2).max(120),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

function generateApiKey() {
  return `ag_${randomBytes(18).toString("hex")}`;
}

export async function GET(request: Request) {
  const adminError = requireAdminAccess(request);
  if (adminError) return adminError;

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("agencies")
    .select("id,name,api_key,primary_color,logo_url,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to list agencies" }, { status: 500 });
  }

  return NextResponse.json({ agencies: data || [] });
}

export async function POST(request: Request) {
  const adminError = requireAdminAccess(request);
  if (adminError) return adminError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createAgencySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const apiKey = generateApiKey();

  const { data, error } = await supabase
    .from("agencies")
    .insert({
      name: parsed.data.name,
      api_key: apiKey,
      primary_color: parsed.data.primaryColor || null,
      logo_url: parsed.data.logoUrl || null,
    })
    .select("id,name,api_key,primary_color,logo_url,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Unable to create agency" }, { status: 500 });
  }

  return NextResponse.json({ agency: data }, { status: 201 });
}
