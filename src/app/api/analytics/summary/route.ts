import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { computeAnalytics, type LeadAnalyticsRow, type MessageAnalyticsRow, type VisitorEventRow } from "@/lib/analytics";
import { getServerSupabase } from "@/lib/supabase";

function isMissingSenderColumnError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("sender") && (normalized.includes("schema cache") || normalized.includes("does not exist"));
}

function isMissingAgencyIdColumnError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("agency_id") && (normalized.includes("schema cache") || normalized.includes("does not exist"));
}

function isMissingRoleColumnError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("role") && (normalized.includes("schema cache") || normalized.includes("does not exist"));
}

async function readMessagesCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  agencyId: string,
  leadIds: string[],
  startIso: string,
) {
  if (leadIds.length === 0) return [] as MessageAnalyticsRow[];

  const withAgencyAndSender = await supabase
    .from("messages")
    .select("lead_id, timestamp, sender, role, content")
    .eq("agency_id", agencyId)
    .in("lead_id", leadIds)
    .gte("timestamp", startIso)
    .order("timestamp", { ascending: true });

  if (!withAgencyAndSender.error) {
    return (withAgencyAndSender.data || []) as MessageAnalyticsRow[];
  }

  const senderMissing = isMissingSenderColumnError(withAgencyAndSender.error.message);
  const agencyMissing = isMissingAgencyIdColumnError(withAgencyAndSender.error.message);

  if (!senderMissing && !agencyMissing) {
    throw withAgencyAndSender.error;
  }

  if (senderMissing && !agencyMissing) {
    const fallbackRole = await supabase
      .from("messages")
      .select("lead_id, timestamp, role, content")
      .eq("agency_id", agencyId)
      .in("lead_id", leadIds)
      .gte("timestamp", startIso)
      .order("timestamp", { ascending: true });

    if (fallbackRole.error) throw fallbackRole.error;
    return (fallbackRole.data || []) as MessageAnalyticsRow[];
  }

  const withoutAgency = await supabase
    .from("messages")
    .select("lead_id, timestamp, sender, role, content")
    .in("lead_id", leadIds)
    .gte("timestamp", startIso)
    .order("timestamp", { ascending: true });

  if (!withoutAgency.error) {
    return (withoutAgency.data || []) as MessageAnalyticsRow[];
  }

  const roleMissing = isMissingRoleColumnError(withoutAgency.error.message);

  if (isMissingSenderColumnError(withoutAgency.error.message) || roleMissing) {
    const contentOnly = await supabase
      .from("messages")
      .select("lead_id, timestamp, content")
      .in("lead_id", leadIds)
      .gte("timestamp", startIso)
      .order("timestamp", { ascending: true });

    if (contentOnly.error) throw contentOnly.error;
    return (contentOnly.data || []) as MessageAnalyticsRow[];
  }

  throw withoutAgency.error;
}

export async function GET(request: Request) {
  const daysParam = Number(new URL(request.url).searchParams.get("days") || "14");
  const days = Number.isFinite(daysParam) ? Math.max(1, Math.min(Math.floor(daysParam), 90)) : 14;

  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

  const { data: leadsData, error: leadsError } = await supabase
    .from("leads")
    .select("id, created_at, status, appointment_status, lead_state")
    .eq("agency_id", agencyContext.agencyId)
    .gte("created_at", start);

  if (leadsError) {
    return NextResponse.json({ error: "Unable to load leads for analytics" }, { status: 500 });
  }

  const leads = (leadsData || []) as LeadAnalyticsRow[];
  const leadIds = leads.map((lead) => lead.id);

  let messages: MessageAnalyticsRow[] = [];
  try {
    messages = await readMessagesCompat(supabase, agencyContext.agencyId, leadIds, start);
  } catch {
    messages = [];
  }

  let visitorEvents: VisitorEventRow[] = [];
  const eventsResult = await supabase
    .from("events")
    .select("created_at, event_type")
    .eq("agency_id", agencyContext.agencyId)
    .gte("created_at", start)
    .order("created_at", { ascending: true });

  if (!eventsResult.error) {
    visitorEvents = (eventsResult.data || []) as VisitorEventRow[];
  }

  const analytics = computeAnalytics(leads, messages, visitorEvents, days);

  if (analytics.daily.length > 0) {
    await supabase.from("daily_stats").upsert(
      analytics.daily.map((row) => ({
        agency_id: agencyContext.agencyId,
        stat_date: row.stat_date,
        visitors: row.visitors,
        leads: row.leads,
        qualified: row.qualified,
        booked: row.booked,
        conversion_rate: row.conversion_rate,
        avg_response_time_seconds: row.avg_response_time_seconds,
        leads_per_day: row.leads_per_day,
      })),
      { onConflict: "agency_id,stat_date" },
    );
  }

  return NextResponse.json({
    summary: analytics.summary,
    daily_stats: analytics.daily,
    charts: {
      leads_over_time: analytics.daily.map((row) => ({ day: row.stat_date, value: row.leads })),
      conversion_percent: analytics.daily.map((row) => ({ day: row.stat_date, value: row.conversion_rate })),
    },
  });
}
