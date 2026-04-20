export type LeadSource = "facebook" | "google" | "organic";
export type SourceBucket = LeadSource | "unknown";

export type SourceLeadRow = {
  source?: string | null;
  status?: string | null;
  appointment_status?: string | null;
  lead_state?: {
    status?: string | null;
    stage?: string | null;
  } | null;
};

export type SourceAnalyticsItem = {
  source: SourceBucket;
  leads: number;
  converted: number;
  conversion_rate: number;
};

export type SourceAnalyticsResult = {
  items: SourceAnalyticsItem[];
  totals: {
    leads: number;
    converted: number;
    conversion_rate: number;
  };
};

const SOURCE_ORDER: SourceBucket[] = ["facebook", "google", "organic", "unknown"];

function round2(value: number) {
  return Number(value.toFixed(2));
}

function normalizeSource(rawSource: string | null | undefined): SourceBucket {
  const normalized = (rawSource || "").trim().toLowerCase();
  if (normalized === "facebook" || normalized === "google" || normalized === "organic") {
    return normalized;
  }
  return "unknown";
}

function isConvertedLead(lead: SourceLeadRow) {
  const appointmentStatus = (lead.appointment_status || "").toLowerCase();
  const status = (lead.status || "").toLowerCase();
  const stateStatus = (lead.lead_state?.status || "").toLowerCase();
  const stateStage = (lead.lead_state?.stage || "").toLowerCase();

  return (
    appointmentStatus === "reserved" ||
    status === "booked" ||
    stateStatus === "booked" ||
    stateStage === "booked"
  );
}

export function computeSourceAnalytics(leads: SourceLeadRow[]): SourceAnalyticsResult {
  const buckets = new Map<SourceBucket, { leads: number; converted: number }>();

  for (const source of SOURCE_ORDER) {
    buckets.set(source, { leads: 0, converted: 0 });
  }

  for (const lead of leads) {
    const source = normalizeSource(lead.source);
    const bucket = buckets.get(source);
    if (!bucket) continue;

    bucket.leads += 1;
    if (isConvertedLead(lead)) {
      bucket.converted += 1;
    }
  }

  const items = SOURCE_ORDER.map((source) => {
    const bucket = buckets.get(source) || { leads: 0, converted: 0 };
    return {
      source,
      leads: bucket.leads,
      converted: bucket.converted,
      conversion_rate: bucket.leads > 0 ? round2((bucket.converted / bucket.leads) * 100) : 0,
    };
  });

  const totalLeads = items.reduce((sum, item) => sum + item.leads, 0);
  const totalConverted = items.reduce((sum, item) => sum + item.converted, 0);

  return {
    items,
    totals: {
      leads: totalLeads,
      converted: totalConverted,
      conversion_rate: totalLeads > 0 ? round2((totalConverted / totalLeads) * 100) : 0,
    },
  };
}
