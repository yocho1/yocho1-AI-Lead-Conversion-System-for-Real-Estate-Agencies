import type { LeadSignals } from "@/lib/types";

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;

const propertyTypeKeywords = [
  "apartment",
  "house",
  "villa",
  "studio",
  "duplex",
  "land",
  "office",
  "commercial",
];

export function extractLeadSignals(input: string): LeadSignals {
  const text = input.toLowerCase();
  const lead: LeadSignals = {};

  const email = input.match(emailRegex)?.[0];
  if (email) lead.email = email;

  const phone = input.match(phoneRegex)?.[0];
  if (phone) lead.phone = phone.trim();

  const budgetMatch = input.match(/\$?\s?\d+(?:[.,]\d+)?(?:\s?(k|m|million))?/i);
  if (budgetMatch) lead.budget = budgetMatch[0];

  const locationMatch = input.match(/(?:in|around|near)\s+([a-zA-Z\s-]{2,40})/i);
  if (locationMatch?.[1]) lead.location = locationMatch[1].trim();

  const timelineMatch = input.match(/(asap|immediately|this month|next month|\d+\s*(?:months?|weeks?))/i);
  if (timelineMatch) lead.buyingTimeline = timelineMatch[0];

  const propertyType = propertyTypeKeywords.find((keyword) => text.includes(keyword));
  if (propertyType) lead.propertyType = propertyType;

  const nameMatch = input.match(/(?:i am|i'm|my name is)\s+([a-zA-Z]{2,20})/i);
  if (nameMatch?.[1]) lead.name = nameMatch[1];

  return lead;
}
