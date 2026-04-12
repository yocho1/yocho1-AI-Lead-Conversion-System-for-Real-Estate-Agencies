import type { LeadSignals, LeadStatus } from "@/lib/types";

export function classifyLead(signals: LeadSignals): LeadStatus {
  let score = 0;

  if (signals.budget) score += 2;
  if (signals.location) score += 2;
  if (signals.propertyType) score += 2;
  if (signals.buyingTimeline) score += 2;
  if (signals.email || signals.phone) score += 2;

  const urgentTerms = ["asap", "immediately", "this week", "this month"];
  if (signals.buyingTimeline && urgentTerms.some((term) => signals.buyingTimeline?.toLowerCase().includes(term))) {
    score += 2;
  }

  if (score >= 8) return "hot";
  if (score >= 5) return "warm";
  return "cold";
}
