export type FunnelStage = "visitor" | "lead" | "qualified" | "booked";

export type LeadAnalyticsRow = {
  id: string;
  created_at: string;
  status?: string | null;
  appointment_status?: string | null;
  lead_state?: {
    status?: string | null;
    stage?: string | null;
  } | null;
};

export type MessageAnalyticsRow = {
  lead_id: string;
  timestamp: string;
  sender?: string | null;
  role?: string | null;
  content?: string | null;
};

export type VisitorEventRow = {
  created_at: string;
  event_type?: string | null;
};

export type DailyStatRecord = {
  stat_date: string;
  visitors: number;
  leads: number;
  qualified: number;
  booked: number;
  conversion_rate: number;
  avg_response_time_seconds: number;
  leads_per_day: number;
};

export type AnalyticsSummary = {
  funnel: Record<FunnelStage, number>;
  conversion_rate: number;
  avg_response_time_seconds: number;
  avg_response_time_minutes: number;
  leads_per_day: number;
};

export type AnalyticsComputation = {
  daily: DailyStatRecord[];
  summary: AnalyticsSummary;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toDayKey(isoDateLike: string) {
  return new Date(isoDateLike).toISOString().slice(0, 10);
}

function round2(value: number) {
  return Number(value.toFixed(2));
}

function isBookedLead(lead: LeadAnalyticsRow) {
  const appointment = (lead.appointment_status || "").toLowerCase();
  const leadStatus = (lead.status || "").toLowerCase();
  const stateStatus = (lead.lead_state?.status || "").toLowerCase();
  const stateStage = (lead.lead_state?.stage || "").toLowerCase();

  return (
    appointment === "reserved" ||
    leadStatus === "booked" ||
    stateStatus === "booked" ||
    stateStage === "booked"
  );
}

function isQualifiedLead(lead: LeadAnalyticsRow) {
  if (isBookedLead(lead)) return true;

  const appointment = (lead.appointment_status || "").toLowerCase();
  const leadStatus = (lead.status || "").toLowerCase();
  const stateStatus = (lead.lead_state?.status || "").toLowerCase();
  const stateStage = (lead.lead_state?.stage || "").toLowerCase();

  return (
    appointment === "pending" ||
    appointment === "reserved" ||
    leadStatus === "hot" ||
    leadStatus === "warm" ||
    stateStatus === "hot" ||
    stateStatus === "warm" ||
    stateStage === "closing"
  );
}

function normalizeSender(message: MessageAnalyticsRow): "user" | "ai" | "agent" {
  const sender = (message.sender || "").toLowerCase();
  if (sender === "ai" || sender === "assistant") return "ai";
  if (sender === "agent") return "agent";
  if (sender === "user") return "user";

  const role = (message.role || "").toLowerCase();
  if (role === "assistant") return "ai";
  if (role === "user") return "user";

  const content = message.content || "";
  if (content.startsWith("[agent]")) return "agent";

  return "user";
}

function getResponseDurationsByDay(messages: MessageAnalyticsRow[]) {
  const sorted = [...messages].sort((a, b) => {
    if (a.lead_id !== b.lead_id) return a.lead_id.localeCompare(b.lead_id);
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  const pendingByLead = new Map<string, number>();
  const durationsByDay = new Map<string, number[]>();

  for (const message of sorted) {
    const sender = normalizeSender(message);
    const ts = new Date(message.timestamp).getTime();
    if (Number.isNaN(ts)) continue;

    if (sender === "user") {
      pendingByLead.set(message.lead_id, ts);
      continue;
    }

    if (sender !== "ai" && sender !== "agent") continue;

    const pendingUserTs = pendingByLead.get(message.lead_id);
    if (!pendingUserTs) continue;

    const deltaSeconds = (ts - pendingUserTs) / 1000;
    pendingByLead.delete(message.lead_id);

    if (deltaSeconds < 0 || deltaSeconds > 24 * 60 * 60) continue;

    const dayKey = toDayKey(message.timestamp);
    const previous = durationsByDay.get(dayKey) || [];
    previous.push(deltaSeconds);
    durationsByDay.set(dayKey, previous);
  }

  return durationsByDay;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildDayRange(days: number) {
  const today = new Date();
  const range: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    range.push(new Date(today.getTime() - i * DAY_MS).toISOString().slice(0, 10));
  }
  return range;
}

export function computeAnalytics(
  leads: LeadAnalyticsRow[],
  messages: MessageAnalyticsRow[],
  visitorEvents: VisitorEventRow[],
  days: number,
): AnalyticsComputation {
  const safeDays = Math.max(1, Math.min(days, 90));
  const dayRange = buildDayRange(safeDays);

  const leadsByDay = new Map<string, number>();
  const qualifiedByDay = new Map<string, number>();
  const bookedByDay = new Map<string, number>();
  const visitorsByDay = new Map<string, number>();

  for (const lead of leads) {
    const dayKey = toDayKey(lead.created_at);
    if (!dayRange.includes(dayKey)) continue;

    leadsByDay.set(dayKey, (leadsByDay.get(dayKey) || 0) + 1);
    if (isQualifiedLead(lead)) {
      qualifiedByDay.set(dayKey, (qualifiedByDay.get(dayKey) || 0) + 1);
    }
    if (isBookedLead(lead)) {
      bookedByDay.set(dayKey, (bookedByDay.get(dayKey) || 0) + 1);
    }
  }

  for (const eventRow of visitorEvents) {
    const eventType = (eventRow.event_type || "").toLowerCase();
    if (!eventType.includes("visitor") && !eventType.includes("visit") && !eventType.includes("page_view")) {
      continue;
    }

    const dayKey = toDayKey(eventRow.created_at);
    if (!dayRange.includes(dayKey)) continue;
    visitorsByDay.set(dayKey, (visitorsByDay.get(dayKey) || 0) + 1);
  }

  const responseByDay = getResponseDurationsByDay(messages);

  const daily: DailyStatRecord[] = dayRange.map((dayKey) => {
    const leadsCount = leadsByDay.get(dayKey) || 0;
    const qualifiedCount = qualifiedByDay.get(dayKey) || 0;
    const bookedCount = bookedByDay.get(dayKey) || 0;
    const visitorCount = Math.max(visitorsByDay.get(dayKey) || 0, leadsCount);
    const responseTimes = responseByDay.get(dayKey) || [];
    const avgResponseTimeSeconds = round2(average(responseTimes));

    return {
      stat_date: dayKey,
      visitors: visitorCount,
      leads: leadsCount,
      qualified: qualifiedCount,
      booked: bookedCount,
      conversion_rate: leadsCount > 0 ? round2((bookedCount / leadsCount) * 100) : 0,
      avg_response_time_seconds: avgResponseTimeSeconds,
      leads_per_day: leadsCount,
    };
  });

  const totals = daily.reduce(
    (acc, stat) => {
      acc.visitors += stat.visitors;
      acc.leads += stat.leads;
      acc.qualified += stat.qualified;
      acc.booked += stat.booked;
      if (stat.avg_response_time_seconds > 0) {
        acc.responseTimes.push(stat.avg_response_time_seconds);
      }
      return acc;
    },
    { visitors: 0, leads: 0, qualified: 0, booked: 0, responseTimes: [] as number[] },
  );

  const avgResponseTimeSeconds = round2(average(totals.responseTimes));
  const summary: AnalyticsSummary = {
    funnel: {
      visitor: totals.visitors,
      lead: totals.leads,
      qualified: totals.qualified,
      booked: totals.booked,
    },
    conversion_rate: totals.leads > 0 ? round2((totals.booked / totals.leads) * 100) : 0,
    avg_response_time_seconds: avgResponseTimeSeconds,
    avg_response_time_minutes: round2(avgResponseTimeSeconds / 60),
    leads_per_day: round2(totals.leads / safeDays),
  };

  return { daily, summary };
}
