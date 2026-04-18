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

const stopwordTokens = new Set([
  "budget",
  "email",
  "phone",
  "timeline",
  "month",
  "months",
  "week",
  "weeks",
  "apartment",
  "villa",
  "house",
  "studio",
  "buy",
  "buying",
  "asap",
  "morning",
  "afternoon",
  "evening",
  "today",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
  "now",
  "soon",
  "yes",
  "no",
  "hello",
  "hi",
  "and",
  "or",
  "from",
  "ok",
  "okay",
  "thanks",
  "thank",
  "thankyou",
  "great",
  "perfect",
  "sure",
]);

function extractStandaloneLocation(input: string) {
  const cleaned = input
    .trim()
    .replace(/[.,!?;:]+/g, "")
    .replace(/\s+/g, " ");

  if (!cleaned) return undefined;

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length !== 1) return undefined;

  const alphaOnly = words.every((word) => /^[a-zA-Z-]{2,}$/.test(word));
  if (!alphaOnly) return undefined;

  const hasStopword = words.some((word) => stopwordTokens.has(word.toLowerCase()));
  if (hasStopword) return undefined;

  return cleaned;
}

function extractName(input: string) {
  const normalizeName = (value: string) =>
    value
      .trim()
      .replace(/\s+(and|et|ou)$/i, "")
      .trim();

  const explicitNameMatch = input.match(
    /(?:my full name(?:\s+is)?|my name is|i am|i'm)\s*[:\-]?\s*([a-zA-Z][a-zA-Z'\-]{1,}(?:\s+[a-zA-Z][a-zA-Z'\-]{1,}){0,2})/i,
  );
  if (explicitNameMatch?.[1]) {
    return normalizeName(explicitNameMatch[1]);
  }

  const csvLikeMatch = input.match(
    /(?:^|[\n\r])\s*([a-zA-Z][a-zA-Z'\-]{1,}(?:\s+[a-zA-Z][a-zA-Z'\-]{1,}){1,2})\s*,\s*([^\n\r]+)/i,
  );
  if (csvLikeMatch?.[1] && csvLikeMatch?.[2]) {
    const trailing = csvLikeMatch[2];
    if (emailRegex.test(trailing) || phoneRegex.test(trailing)) {
      return normalizeName(csvLikeMatch[1]);
    }
  }

  return undefined;
}

export function extractLeadSignals(input: string): LeadSignals {
  const text = input.toLowerCase();
  const lead: LeadSignals = {};

  const email = input.match(emailRegex)?.[0];
  if (email) lead.email = email;

  const phone = input.match(phoneRegex)?.[0];
  if (phone) lead.phone = phone.trim();

  const budgetWithCurrencyOrScale = input.match(
    /(?:\$|€|£|\busd\b|\beur\b|\baed\b|\bmad\b)\s*\d+(?:[\s,]\d{3})*(?:[.,]\d+)?(?:\s?(?:k|m|million))?|\b\d+(?:[\s,]\d{3})*(?:[.,]\d+)?\s?(?:k|m|million)\b/i,
  );
  const budgetWithKeyword = input.match(/\bbudget\b[^\d]{0,12}(\d{2,6}(?:[.,]\d+)?)/i);
  const standaloneNumber = input.trim().match(/^\d{2,4}$/);

  if (budgetWithCurrencyOrScale) {
    lead.budget = budgetWithCurrencyOrScale[0].trim();
  } else if (budgetWithKeyword?.[1]) {
    lead.budget = budgetWithKeyword[1].trim();
  } else if (standaloneNumber) {
    lead.budget = standaloneNumber[0];
  }

  const locationWithBudgetMatch = input.match(/^\s*([a-zA-Z][a-zA-Z-]{1,})\s+and\s+\$?\s*\d/i);
  if (locationWithBudgetMatch?.[1]) {
    lead.location = locationWithBudgetMatch[1].trim();
  }

  const locationMatch = input.match(
    /\b(?:in|around|near)\b\s+([a-zA-Z\s-]{2,40}?)(?=\s+(?:budget|for|with|price|\$|\d)|[,.!?]|$)/i,
  );
  if (!lead.location && locationMatch?.[1]) {
    lead.location = locationMatch[1].trim();
  } else if (!lead.location) {
    const standaloneLocation = extractStandaloneLocation(input);
    if (standaloneLocation) {
      lead.location = standaloneLocation;
    }
  }

  const timelineMatch = input.match(
    /(as soon as possible|asap|immediately|urgent|soon|from now|now|this month|next month|this week|next week|\d+\s*(?:months?|weeks?))/i,
  );
  if (timelineMatch) {
    lead.buyingTimeline = timelineMatch[0];
  } else {
    const shortIntent = text.trim();
    if (
      /^(buy|move|relocate)$/i.test(shortIntent) ||
      /^(i\s+)?(wanna|want\s+to)\s+(buy|move)/i.test(shortIntent)
    ) {
      lead.buyingTimeline = "soon";
    } else if (/\b(?:wanna|want\s+to)\s+(?:buy|move|relocate)\b|\b(?:buy|move|relocate)\b/i.test(text)) {
      lead.buyingTimeline = "soon";
    }
  }

  const propertyType = propertyTypeKeywords.find((keyword) => text.includes(keyword));
  if (propertyType) lead.propertyType = propertyType;

  const name = extractName(input);
  if (name) lead.name = name;

  return lead;
}
