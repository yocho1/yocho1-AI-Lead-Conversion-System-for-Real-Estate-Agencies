import { extractPreferredVisitDay, extractPreferredVisitPeriod } from "@/lib/appointment";
import { extractLeadSignals } from "@/lib/lead-parser";
import type { LeadFieldKey, LeadState } from "@/lib/types";
import {
  computeLeadTemperature,
  createInitialLeadState,
  getNextRequiredField,
  isMeaninglessInput,
  normalizeBudget,
  normalizeContact,
  normalizeLocation,
  normalizeName,
  normalizePropertyType,
  normalizeTimeline,
} from "@/lib/validation";

export type EngineResult = {
  state: LeadState;
  budgetLabel: string | null;
  invalidField: LeadFieldKey | null;
  visitDay: string | null;
  visitPeriod: string | null;
};

export function applyUserInputToState(previous: LeadState, message: string): EngineResult {
  const state: LeadState = { ...createInitialLeadState(), ...previous };
  const extracted = extractLeadSignals(message);
  const expectedField = getNextRequiredField(state);
  let invalidField: LeadFieldKey | null = null;

  const locationCandidate = extracted.location || message;
  if ((!state.location.raw && !state.location.city && !state.location.country) && locationCandidate) {
    const location = normalizeLocation(locationCandidate);
    if (location.ok) {
      state.location = location.value;
    }
  }

  const budgetCandidate = extracted.budget || message;
  if (!state.budget && budgetCandidate) {
    const budget = normalizeBudget(budgetCandidate);
    if (budget.ok) {
      state.budget = budget.value.value;
      state.currency = budget.value.currency;
    }
  }

  const propertyTypeCandidate = extracted.propertyType || message;
  if (!state.property_type && propertyTypeCandidate) {
    const propertyType = normalizePropertyType(propertyTypeCandidate);
    if (propertyType.ok) {
      state.property_type = propertyType.value;
    }
  }

  const timelineCandidate = extracted.buyingTimeline || message;
  if (!state.timeline_normalized && timelineCandidate) {
    const timeline = normalizeTimeline(timelineCandidate);
    if (timeline.ok) {
      state.timeline = timeline.value.raw;
      state.timeline_normalized = timeline.value.normalized;
    }
  }

  const contactCandidate = [extracted.email, extracted.phone].filter(Boolean).join(" ") || message;
  if (!state.contact && contactCandidate) {
    const contact = normalizeContact(contactCandidate);
    if (contact.ok) {
      state.contact = contact.value;
      if (contact.value.includes("@")) {
        state.email = contact.value.toLowerCase();
      } else {
        state.phone = contact.value;
      }
    }
  }

  const nameCandidate = extracted.name || (expectedField === "name" ? message : null);
  if (!state.name && nameCandidate) {
    const name = normalizeName(nameCandidate);
    if (name.ok) {
      state.name = name.value;
    }
  }

  if (expectedField) {
    const stillMissing = isFieldMissing(state, expectedField);
    if (stillMissing && isMeaninglessInput(message)) {
      invalidField = expectedField;
    }
  }

  const visitDay = extractPreferredVisitDay(message);
  const visitPeriod = extractPreferredVisitPeriod(message);

  state.status = computeLeadTemperature(state);
  state.stage = hasAllMandatoryFields(state) ? "closing" : "collecting";

  return {
    state,
    budgetLabel: state.budget ? formatBudget(state.budget, state.currency || "USD") : null,
    invalidField,
    visitDay,
    visitPeriod,
  };
}

export function getQuestionForField(field: LeadFieldKey) {
  switch (field) {
    case "location":
      return "Which city or area should I target for your property search?";
    case "budget":
      return "What budget should I work with?";
    case "property_type":
      return "What property type do you prefer: apartment, villa, townhouse, or house?";
    case "timeline":
      return "When do you want to move: asap, this week, or next month?";
    case "name":
      return "Great. What is your full name?";
    case "contact":
      return "Share your phone or email so I can lock your visit slot.";
    default:
      return "Share one detail so I can continue.";
  }
}

export function getInvalidFieldMessage(field: LeadFieldKey) {
  switch (field) {
    case "location":
      return "Please share a city or country so I can match the right listings.";
    case "budget":
      return "Please share your budget, for example 100k or 100,000.";
    case "property_type":
      return "Please choose a property type, for example apartment or villa.";
    case "timeline":
      return "Please share a timeline, for example asap or this week.";
    case "name":
      return "Please share your full name so I can complete your profile.";
    case "contact":
      return "Please share a valid phone number or email.";
    default:
      return "Please clarify that detail so I can continue.";
  }
}

export function hasAllMandatoryFields(state: LeadState) {
  return Boolean(
    state.name &&
      (state.contact || state.email || state.phone) &&
      state.budget &&
      (state.location.raw || state.location.city || state.location.country) &&
      state.property_type &&
      state.timeline_normalized,
  );
}

function isFieldMissing(state: LeadState, field: LeadFieldKey) {
  switch (field) {
    case "location":
      return !state.location.raw && !state.location.city && !state.location.country;
    case "budget":
      return !state.budget;
    case "property_type":
      return !state.property_type;
    case "timeline":
      return !state.timeline_normalized;
    case "name":
      return !state.name;
    case "contact":
      return !state.contact && !state.email && !state.phone;
    default:
      return true;
  }
}

function formatBudget(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${value.toLocaleString()}`;
  }
}
