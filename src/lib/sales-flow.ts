import type { LeadSignals } from "@/lib/types";

export function getMissingQualificationFields(signals: LeadSignals) {
  const missing: string[] = [];
  if (!signals.budget) missing.push("budget");
  if (!signals.location) missing.push("location");
  if (!signals.propertyType) missing.push("property type");
  if (!signals.buyingTimeline) missing.push("timeline");
  return missing;
}

export function getNextQualificationQuestion(missingFields: string[]) {
  if (missingFields.includes("budget")) {
    return "What budget range are you targeting so I can shortlist matching properties?";
  }

  if (missingFields.includes("location")) {
    return "Which location should I focus on for your property search?";
  }

  if (missingFields.includes("property type")) {
    return "Do you prefer an apartment, villa, townhouse, or another property type?";
  }

  if (missingFields.includes("timeline")) {
    return "How soon are you planning to buy or move?";
  }

  return null;
}

export function getRepeatedQuestionSafeVariant(field: string) {
  if (field === "budget") {
    return "To shortlist serious options now, what budget range should I target?";
  }

  if (field === "location") {
    return "Which exact area should I prioritize for your visit shortlist?";
  }

  if (field === "property type") {
    return "Quick one: are you focused on villas, apartments, or another property type?";
  }

  if (field === "timeline") {
    return "When do you want to close this purchase, approximately?";
  }

  return "Could you share one more detail so I can continue with matching?";
}

export function shouldEnterClosingMode(signals: LeadSignals) {
  return Boolean(signals.budget && signals.location && signals.buyingTimeline);
}
