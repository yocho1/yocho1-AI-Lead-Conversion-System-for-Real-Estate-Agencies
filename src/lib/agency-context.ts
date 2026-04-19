import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const AGENCY_KEY_HEADERS = ["x-agency-key", "x-agency-api-key"] as const;
const AGENCY_KEY_QUERY_PARAMS = ["agencyApiKey", "agencyKey"] as const;

function normalizeAgencyKey(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function extractAgencyKeyFromRequest(request: Request): string | null {
  const url = new URL(request.url);

  for (const param of AGENCY_KEY_QUERY_PARAMS) {
    const value = normalizeAgencyKey(url.searchParams.get(param));
    if (value) return value;
  }

  for (const headerName of AGENCY_KEY_HEADERS) {
    const value = normalizeAgencyKey(request.headers.get(headerName));
    if (value) return value;
  }

  const authHeader = normalizeAgencyKey(request.headers.get("authorization"));
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return normalizeAgencyKey(authHeader.slice(7));
  }

  return null;
}

export async function resolveAgencyByApiKey(
  supabase: ReturnType<typeof getServerSupabase>,
  agencyApiKey: string,
): Promise<{ id: string; api_key: string } | null> {
  const normalizedKey = normalizeAgencyKey(agencyApiKey);
  if (!normalizedKey) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("id, api_key")
    .eq("api_key", normalizedKey)
    .maybeSingle();

  return agency || null;
}

export async function requireAgencyContext(
  request: Request,
  supabase: ReturnType<typeof getServerSupabase>,
): Promise<{ agencyId: string; agencyApiKey: string } | NextResponse> {
  const agencyApiKey = extractAgencyKeyFromRequest(request);

  if (!agencyApiKey) {
    return NextResponse.json({ error: "Missing agency key" }, { status: 400 });
  }

  const hintedAgencyId = normalizeAgencyKey(request.headers.get("x-agency-id"));
  if (hintedAgencyId) {
    const { data: hintedAgency } = await supabase
      .from("agencies")
      .select("id, api_key")
      .eq("id", hintedAgencyId)
      .eq("api_key", agencyApiKey)
      .maybeSingle();

    if (hintedAgency) {
      return { agencyId: hintedAgency.id, agencyApiKey: hintedAgency.api_key };
    }
  }

  const agency = await resolveAgencyByApiKey(supabase, agencyApiKey);
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  return { agencyId: agency.id, agencyApiKey: agency.api_key };
}

export function requireAdminAccess(request: Request): NextResponse | null {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return null;

  const incomingAdminKey = request.headers.get("x-admin-key")?.trim();
  if (!incomingAdminKey || incomingAdminKey !== adminKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
