import type { LeadFieldKey, LeadState } from "@/lib/types";

const INVALID_TOKENS = new Set(["ok", "okay", "yes", "no", "test", "test123", "hello", "hi", "asd", "asdf", "asd123"]);

const locationAliases: Record<string, { city?: string; country?: string }> = {
  casa: { city: "Casablanca", country: "Morocco" },
  casablanca: { city: "Casablanca", country: "Morocco" },
  rabat: { city: "Rabat", country: "Morocco" },
  marrakech: { city: "Marrakech", country: "Morocco" },
  paris: { city: "Paris", country: "France" },
  london: { city: "London", country: "United Kingdom" },
  dubai: { city: "Dubai", country: "United Arab Emirates" },
  "dubai marina": { city: "Dubai Marina", country: "United Arab Emirates" },
  doha: { city: "Doha", country: "Qatar" },
  madrid: { city: "Madrid", country: "Spain" },
  barcelona: { city: "Barcelona", country: "Spain" },
};

const knownCountries = new Set([
  "morocco",
  "france",
  "spain",
  "portugal",
  "italy",
  "germany",
  "united arab emirates",
  "uae",
  "qatar",
  "saudi arabia",
  "egypt",
  "united kingdom",
  "uk",
  "united states",
  "usa",
  "canada",
]);

const propertyTypeAliases: Record<string, string> = {
  apartment: "apartment",
  appart: "apartment",
  apprtment: "apartment",
  appartment: "apartment",
  flat: "apartment",
  villa: "villa",
  "villa house": "villa",
  house: "house",
  townhouse: "townhouse",
  townhome: "townhouse",
  studio: "studio",
  duplex: "duplex",
  land: "land",
  office: "office",
  commercial: "commercial",
};

const timelineMap: Array<{ pattern: RegExp; normalized: string; label: string }> = [
  { pattern: /\b(today|this day|tomorrow|next day|asap|immediately|urgent|right now)\b/i, normalized: "asap", label: "asap" },
  { pattern: /\bthis\s+week\b/i, normalized: "this_week", label: "this week" },
  { pattern: /\bnext\s+week\b/i, normalized: "next_week", label: "next week" },
  { pattern: /\bthis\s+month\b/i, normalized: "this_month", label: "this month" },
  { pattern: /\bnext\s+month\b/i, normalized: "next_month", label: "next month" },
  { pattern: /\bsoon\b/i, normalized: "soon", label: "soon" },
];

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const phoneRegex = /(\+?\d[\d\s().-]{7,}\d)/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false };

export type NormalizedBudget = {
  value: number;
  currency: string;
};

export type NormalizedLocation = {
  raw: string;
  city: string | null;
  country: string | null;
};

export type NormalizedTimeline = {
  raw: string;
  normalized: string;
};

export function createInitialLeadState(): LeadState {
  return {
    id: null,
    name: null,
    email: null,
    phone: null,
    contact: null,
    budget: null,
    currency: null,
    location: {
      raw: null,
      city: null,
      country: null,
    },
    property_type: null,
    timeline: null,
    timeline_normalized: null,
    status: "new",
    stage: "collecting",
    last_question: null,
    created_at: new Date().toISOString(),
  };
}

export function isMeaninglessInput(raw: string) {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return true;
  if (INVALID_TOKENS.has(cleaned)) return true;
  if (/^[a-z]{1,2}$/.test(cleaned)) return true;
  return false;
}

export function normalizeName(raw: string): ValidationResult<string> {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length < 2) return { ok: false };
  if (INVALID_TOKENS.has(cleaned.toLowerCase())) return { ok: false };
  if (!/^[a-zA-Z][a-zA-Z'\- ]+$/.test(cleaned)) return { ok: false };
  if (cleaned.split(" ").length < 2) return { ok: false };
  return { ok: true, value: cleaned };
}

export function normalizeLocation(raw: string): ValidationResult<NormalizedLocation> {
  const cleaned = raw
    .trim()
    .replace(/[.,!?;:]+/g, " ")
    .replace(/\s+/g, " ");

  const cleanedWithoutFiller = cleaned
    .replace(/\b(budget|with|for|around|price|usd|eur|aed|mad)\b.*$/i, "")
    .trim();

  const lower = cleanedWithoutFiller.toLowerCase();
  if (lower.length < 2) return { ok: false };
  if (INVALID_TOKENS.has(lower)) return { ok: false };
  if (/([a-z])\1\1/.test(lower)) return { ok: false };
  if (!/^[a-z\- ]+$/i.test(cleanedWithoutFiller)) return { ok: false };

  if (locationAliases[lower]) {
    return {
      ok: true,
      value: {
        raw: cleaned,
        city: locationAliases[lower].city || null,
        country: locationAliases[lower].country || null,
      },
    };
  }

  const parts = lower.split(/,|\s+/).filter(Boolean);
  if (parts.length === 0) return { ok: false };

  let country: string | null = null;
  for (const name of knownCountries) {
    if (lower.includes(name)) {
      country = toTitle(name);
      break;
    }
  }

  let city: string | null = null;
  const knownCity = Object.entries(locationAliases).find(([key, value]) => value.city && lower.includes(key));
  if (knownCity?.[1].city) {
    city = knownCity[1].city;
    if (!country && knownCity[1].country) country = knownCity[1].country;
  } else if (parts.length <= 3) {
    const candidate = parts.filter((token) => !knownCountries.has(token)).slice(0, 2).join(" ");
    city = candidate ? toTitle(candidate) : null;
  }

  if (!city && !country) return { ok: false };

  return {
    ok: true,
    value: {
      raw: cleaned,
      city,
      country,
    },
  };
}

export function normalizeBudget(raw: string): ValidationResult<NormalizedBudget> {
  const text = raw.trim().toLowerCase();
  const symbolCurrency = text.includes("€") ? "EUR" : text.includes("£") ? "GBP" : "USD";

  const inferredCurrency = /\baed\b/i.test(text)
    ? "AED"
    : /\beur\b/i.test(text)
      ? "EUR"
      : /\bmad\b/i.test(text)
        ? "MAD"
        : /\busd\b/i.test(text)
          ? "USD"
          : symbolCurrency;

  const cleaned = text
    .replace(/,/g, "")
    .replace(/(?<=\d)\s+(?=\d)/g, "");
  const match = cleaned.match(/(\d+(?:\.\d+)?)(?:\s?)(k|m|million)?/i);
  if (!match) return { ok: false };

  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return { ok: false };
  const scale = match[2]?.toLowerCase();

  if (scale === "k") amount *= 1000;
  if (scale === "m" || scale === "million") amount *= 1000000;

  const normalized = Math.round(amount);
  if (normalized < 10000 || normalized > 100000000) return { ok: false };

  return { ok: true, value: { value: normalized, currency: inferredCurrency } };
}

export function normalizeContact(raw: string): ValidationResult<string> {
  const email = raw.match(emailRegex)?.[0]?.toLowerCase();
  if (email) return { ok: true, value: email };

  const phone = raw.match(phoneRegex)?.[0]?.trim();
  if (!phone) return { ok: false };

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return { ok: false };
  return { ok: true, value: phone };
}

export function normalizePropertyType(raw: string): ValidationResult<string> {
  const lower = raw.toLowerCase();
  const found = Object.entries(propertyTypeAliases).find(([key]) => lower.includes(key));
  if (!found) return { ok: false };
  return { ok: true, value: found[1] };
}

export function normalizeTimeline(raw: string): ValidationResult<NormalizedTimeline> {
  for (const item of timelineMap) {
    if (item.pattern.test(raw)) {
      return { ok: true, value: { raw: item.label, normalized: item.normalized } };
    }
  }

  const explicit = raw.match(/\b\d+\s*(week|weeks|month|months)\b/i)?.[0];
  if (explicit) {
    const lower = explicit.toLowerCase();
    return {
      ok: true,
      value: {
        raw: lower,
        normalized: lower.includes("week") ? "this_week" : "next_month",
      },
    };
  }

  return { ok: false };
}

export function getNextRequiredField(state: LeadState): LeadFieldKey | null {
  if (!state.location.city && !state.location.country && !state.location.raw) return "location";
  if (!state.budget) return "budget";
  if (!state.property_type) return "property_type";
  if (!state.timeline_normalized) return "timeline";
  if (!state.name) return "name";
  if (!state.contact && !state.email && !state.phone) return "contact";
  return null;
}

export function computeLeadTemperature(state: LeadState): "hot" | "warm" | "cold" {
  const hasContact = Boolean(state.contact || state.email || state.phone);
  const hasBudget = Boolean(state.budget);
  const urgent = state.timeline_normalized === "asap" || state.timeline_normalized === "this_week";

  if (hasBudget && hasContact && urgent) {
    return "hot";
  }

  const score = [
    Boolean(state.location.city || state.location.country || state.location.raw),
    hasBudget,
    Boolean(state.property_type),
    Boolean(state.timeline_normalized),
    hasContact,
    Boolean(state.name),
  ].filter(Boolean).length;

  if (score >= 4) return "warm";
  return "cold";
}

function toTitle(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
