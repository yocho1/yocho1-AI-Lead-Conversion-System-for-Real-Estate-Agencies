import { NextRequest, NextResponse } from "next/server";

const CACHE_TTL_MS = 60_000;
const agencyCache = new Map<string, { agencyId: string; expiresAt: number }>();

function extractAgencyKey(request: NextRequest): string | null {
  const searchKey = request.nextUrl.searchParams.get("agencyApiKey") || request.nextUrl.searchParams.get("agencyKey");
  if (searchKey?.trim()) return searchKey.trim();

  const headerKey = request.headers.get("x-agency-key") || request.headers.get("x-agency-api-key");
  if (headerKey?.trim()) return headerKey.trim();

  return null;
}

async function resolveAgencyId(agencyKey: string): Promise<string | null> {
  const now = Date.now();
  const cached = agencyCache.get(agencyKey);
  if (cached && cached.expiresAt > now) {
    return cached.agencyId;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const url = new URL("/rest/v1/agencies", supabaseUrl);
  url.searchParams.set("select", "id");
  url.searchParams.set("api_key", `eq.${agencyKey}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Array<{ id?: string }>;
  const agencyId = payload?.[0]?.id;
  if (!agencyId) {
    return null;
  }

  agencyCache.set(agencyKey, { agencyId, expiresAt: now + CACHE_TTL_MS });
  return agencyId;
}

export async function middleware(request: NextRequest) {
  const agencyKey = extractAgencyKey(request);

  if (!agencyKey) {
    return NextResponse.next();
  }

  const headers = new Headers(request.headers);
  headers.set("x-agency-key", agencyKey);

  const agencyId = await resolveAgencyId(agencyKey);
  if (agencyId) {
    headers.set("x-agency-id", agencyId);
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
