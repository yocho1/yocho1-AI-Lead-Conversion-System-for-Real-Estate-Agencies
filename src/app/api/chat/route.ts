import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDynamicCalendarLink, resolveVisitSlot } from "@/lib/appointment";
import { resolveAgencyByApiKey } from "@/lib/agency-context";
import {
  applyUserInputToState,
  getInvalidFieldMessage,
  getQuestionForField,
  hasAllMandatoryFields,
} from "@/lib/conversation-engine";
import { sendHotLeadAlertEmail } from "@/lib/notifications";
import { getServerSupabase } from "@/lib/supabase";
import type { LeadState } from "@/lib/types";
import { createInitialLeadState, getNextRequiredField } from "@/lib/validation";

const payloadSchema = z.object({
  agencyApiKey: z.string().min(4),
  message: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
  demoMode: z.boolean().optional(),
  source: z.enum(["facebook", "google", "organic"]).optional(),
  campaignId: z.string().trim().min(1).max(120).optional(),
});

type LeadDbRow = {
  id: string;
  source: "facebook" | "google" | "organic" | null;
  campaign_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  budget: string | null;
  budget_value: number | null;
  currency: string | null;
  location: string | null;
  location_city: string | null;
  location_country: string | null;
  property_type: string | null;
  buying_timeline: string | null;
  timeline_normalized: string | null;
  preferred_visit_day: string | null;
  preferred_visit_period: string | null;
  appointment_status: "not_set" | "pending" | "reserved";
  hot_alert_sent: boolean;
  chat_locked: boolean;
  lead_state: LeadState | null;
};

const DEMO_STATE: LeadState = {
  id: "demo-hot-lead",
  name: "Demo Buyer",
  email: "demo.buyer@example.com",
  phone: "+15551234567",
  contact: "+1 555 123 4567",
  budget: 550000,
  currency: "USD",
  location: {
    raw: "Dubai Marina",
    city: "Dubai Marina",
    country: "United Arab Emirates",
  },
  property_type: "apartment",
  timeline: "asap",
  timeline_normalized: "asap",
  status: "hot",
  stage: "closing",
  last_question: null,
  created_at: new Date().toISOString(),
};

function fillStateWithDefaults(base: LeadState, defaults: LeadState): LeadState {
  return {
    id: base.id || defaults.id,
    name: base.name || defaults.name,
    email: base.email || defaults.email,
    phone: base.phone || defaults.phone,
    contact: base.contact || defaults.contact,
    budget: base.budget || defaults.budget,
    currency: base.currency || defaults.currency,
    location: {
      raw: base.location.raw || defaults.location.raw,
      city: base.location.city || defaults.location.city,
      country: base.location.country || defaults.location.country,
    },
    property_type: base.property_type || defaults.property_type,
    timeline: base.timeline || defaults.timeline,
    timeline_normalized: base.timeline_normalized || defaults.timeline_normalized,
    status: base.status === "new" ? defaults.status : base.status,
    stage: base.stage === "collecting" ? defaults.stage : base.stage,
    last_question: base.last_question || defaults.last_question,
    created_at: base.created_at || defaults.created_at,
  };
}

function hydrateState(lead: LeadDbRow | null): LeadState {
  if (!lead) return createInitialLeadState();

  if (lead.lead_state && typeof lead.lead_state === "object") {
    const rawState = lead.lead_state as Partial<LeadState> & {
      location?: LeadState["location"] | string | null;
    };
    const locationFromState =
      rawState.location && typeof rawState.location === "object"
        ? {
            raw: rawState.location.raw || null,
            city: rawState.location.city || null,
            country: rawState.location.country || null,
          }
        : {
            raw: typeof rawState.location === "string" ? rawState.location : lead.location,
            city: lead.location_city,
            country: lead.location_country,
          };

    return {
      ...createInitialLeadState(),
      ...rawState,
      id: rawState.id || lead.id,
      email: rawState.email || lead.email,
      phone: rawState.phone || lead.phone,
      contact: rawState.contact || rawState.email || rawState.phone || lead.email || lead.phone,
      location: locationFromState,
      currency: rawState.currency || lead.currency || "USD",
      last_question: rawState.last_question || null,
      timeline_normalized: rawState.timeline_normalized || lead.timeline_normalized || null,
    };
  }

  const numericBudget = lead.budget_value ?? (lead.budget ? Number(String(lead.budget).replace(/[^\d.]/g, "")) : null);

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    contact: lead.email || lead.phone,
    budget: Number.isFinite(numericBudget) ? Math.round(numericBudget as number) : null,
    currency: lead.currency || "USD",
    location: {
      raw: lead.location,
      city: lead.location_city,
      country: lead.location_country,
    },
    property_type: lead.property_type,
    timeline: lead.buying_timeline,
    timeline_normalized: lead.timeline_normalized,
    status: "new",
    stage: "collecting",
    last_question: null,
    created_at: new Date().toISOString(),
  };
}

function getMissingFieldsInOrder(state: LeadState) {
  const missing: Array<"location" | "budget" | "property_type" | "timeline" | "name" | "contact"> = [];
  if (!state.location.raw && !state.location.city && !state.location.country) missing.push("location");
  if (!state.budget) missing.push("budget");
  if (!state.property_type) missing.push("property_type");
  if (!state.timeline_normalized) missing.push("timeline");
  if (!state.name) missing.push("name");
  if (!state.contact && !state.email && !state.phone) missing.push("contact");
  return missing;
}

function getNextFieldWithLoopGuard(state: LeadState) {
  const missing = getMissingFieldsInOrder(state);
  if (missing.length === 0) return null;
  if (state.last_question && missing[0] === state.last_question && missing.length > 1) {
    return missing[1];
  }
  return missing[0];
}

function getEmailAndPhone(contact: string | null) {
  if (!contact) return { email: null, phone: null };
  if (contact.includes("@")) {
    return { email: contact.toLowerCase(), phone: null };
  }
  return { email: null, phone: contact };
}

function getClosingDayQuestion() {
  return "Perfect - based on what you want, we have strong options. Properties in your budget are moving fast right now. What day works best for your visit this week?";
}

function getClosingPeriodQuestion() {
  return "Great choice. Do you prefer a morning or afternoon visit?";
}

function getClosingDayFollowUpQuestion() {
  return "Please share the exact day for your visit, for example Monday, Thursday, or tomorrow.";
}

function getClosingPeriodFollowUpQuestion() {
  return "Thanks. Now choose the visit period: morning or afternoon.";
}

function isMissingSenderColumnError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("sender") &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
}

function isMissingAgencyIdColumnError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("agency_id") &&
    (normalized.includes("schema cache") || normalized.includes("does not exist"))
  );
}

function isMissingColumnError(errorMessage: string | undefined, column: string) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes(column.toLowerCase()) &&
    (normalized.includes("schema cache") || normalized.includes("does not exist") || normalized.includes("could not find"))
  );
}

function omitKeys<T extends Record<string, unknown>>(value: T, keys: string[]) {
  const copy = { ...value } as Record<string, unknown>;
  for (const key of keys) {
    delete copy[key];
  }
  return copy;
}

async function insertLeadCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  payload: Record<string, unknown>,
) {
  const attempts = [
    payload,
    omitKeys(payload, ["source", "campaign_id"]),
    omitKeys(payload, ["source", "campaign_id", "last_message_at"]),
    omitKeys(payload, [
      "source",
      "campaign_id",
      "last_message_at",
      "budget_value",
      "currency",
      "location_city",
      "location_country",
      "timeline_normalized",
      "preferred_visit_day",
      "preferred_visit_period",
      "appointment_status",
      "hot_alert_sent",
      "lead_state",
      "chat_locked",
    ]),
  ];

  let lastError: { message?: string } | null = null;

  for (const candidate of attempts) {
    const result = await supabase.from("leads").insert(candidate).select("id").single();
    if (!result.error && result.data) {
      return result;
    }

    lastError = result.error;
    const errorMessage = result.error?.message;
    const shouldRetry =
      isMissingColumnError(errorMessage, "source") ||
      isMissingColumnError(errorMessage, "campaign_id") ||
      isMissingColumnError(errorMessage, "last_message_at") ||
      isMissingColumnError(errorMessage, "budget_value") ||
      isMissingColumnError(errorMessage, "currency") ||
      isMissingColumnError(errorMessage, "location_city") ||
      isMissingColumnError(errorMessage, "location_country") ||
      isMissingColumnError(errorMessage, "timeline_normalized") ||
      isMissingColumnError(errorMessage, "preferred_visit_day") ||
      isMissingColumnError(errorMessage, "preferred_visit_period") ||
      isMissingColumnError(errorMessage, "appointment_status") ||
      isMissingColumnError(errorMessage, "hot_alert_sent") ||
      isMissingColumnError(errorMessage, "lead_state") ||
      isMissingColumnError(errorMessage, "chat_locked");

    if (!shouldRetry) {
      return result;
    }
  }

  return { data: null, error: lastError };
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toNullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toLeadDbRowCompat(row: Record<string, unknown>): LeadDbRow {
  return {
    id: String(row.id),
    source:
      row.source === "facebook" || row.source === "google" || row.source === "organic"
        ? row.source
        : null,
    campaign_id: toNullableString(row.campaign_id),
    name: toNullableString(row.name),
    email: toNullableString(row.email),
    phone: toNullableString(row.phone),
    budget: toNullableString(row.budget),
    budget_value: toNullableNumber(row.budget_value),
    currency: toNullableString(row.currency),
    location: toNullableString(row.location),
    location_city: toNullableString(row.location_city),
    location_country: toNullableString(row.location_country),
    property_type: toNullableString(row.property_type),
    buying_timeline: toNullableString(row.buying_timeline),
    timeline_normalized: toNullableString(row.timeline_normalized),
    preferred_visit_day: toNullableString(row.preferred_visit_day),
    preferred_visit_period: toNullableString(row.preferred_visit_period),
    appointment_status:
      row.appointment_status === "pending" || row.appointment_status === "reserved"
        ? row.appointment_status
        : "not_set",
    hot_alert_sent: toNullableBoolean(row.hot_alert_sent) ?? false,
    chat_locked: toNullableBoolean(row.chat_locked) ?? false,
    lead_state: (row.lead_state && typeof row.lead_state === "object") ? (row.lead_state as LeadState) : null,
  };
}

async function loadLeadCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
  agencyId: string,
) {
  const fullSelect =
    "id,source,campaign_id,name,email,phone,budget,budget_value,currency,location,location_city,location_country,property_type,buying_timeline,timeline_normalized,preferred_visit_day,preferred_visit_period,appointment_status,hot_alert_sent,chat_locked,lead_state";

  const reducedSelect =
    "id,name,email,phone,budget,location,property_type,buying_timeline,lead_state,chat_locked,preferred_visit_day,preferred_visit_period,appointment_status,hot_alert_sent";

  const minimalSelect =
    "id,name,email,phone,budget,location,property_type,buying_timeline";

  const attempts = [fullSelect, reducedSelect, minimalSelect];
  let lastError: { message?: string } | null = null;

  for (const selectClause of attempts) {
    const result = await supabase
      .from("leads")
      .select(selectClause)
      .eq("id", leadId)
      .eq("agency_id", agencyId)
      .single();

    if (!result.error && result.data) {
      return { data: toLeadDbRowCompat(result.data as unknown as Record<string, unknown>), error: null };
    }

    lastError = result.error;
    if (!isMissingColumnError(result.error?.message, "source")
      && !isMissingColumnError(result.error?.message, "campaign_id")
      && !isMissingColumnError(result.error?.message, "budget_value")
      && !isMissingColumnError(result.error?.message, "currency")
      && !isMissingColumnError(result.error?.message, "location_city")
      && !isMissingColumnError(result.error?.message, "location_country")
      && !isMissingColumnError(result.error?.message, "timeline_normalized")
      && !isMissingColumnError(result.error?.message, "preferred_visit_day")
      && !isMissingColumnError(result.error?.message, "preferred_visit_period")
      && !isMissingColumnError(result.error?.message, "appointment_status")
      && !isMissingColumnError(result.error?.message, "hot_alert_sent")
      && !isMissingColumnError(result.error?.message, "chat_locked")
      && !isMissingColumnError(result.error?.message, "lead_state")) {
      return { data: null, error: result.error };
    }
  }

  return { data: null, error: lastError };
}

async function updateLeadCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
  agencyId: string,
  payload: Record<string, unknown>,
) {
  const attempts = [
    payload,
    omitKeys(payload, ["source", "campaign_id"]),
    omitKeys(payload, ["source", "campaign_id", "budget_value", "currency", "location_city", "location_country", "timeline_normalized"]),
    omitKeys(payload, [
      "source",
      "campaign_id",
      "budget_value",
      "currency",
      "location_city",
      "location_country",
      "timeline_normalized",
      "preferred_visit_day",
      "preferred_visit_period",
      "appointment_status",
      "chat_locked",
      "lead_state",
      "hot_alert_sent",
      "last_message_at",
    ]),
  ];

  let lastError: { message?: string } | null = null;

  for (const candidate of attempts) {
    const result = await supabase
      .from("leads")
      .update(candidate)
      .eq("id", leadId)
      .eq("agency_id", agencyId);

    if (!result.error) {
      return result;
    }

    lastError = result.error;
    const shouldRetry =
      isMissingColumnError(result.error?.message, "source") ||
      isMissingColumnError(result.error?.message, "campaign_id") ||
      isMissingColumnError(result.error?.message, "budget_value") ||
      isMissingColumnError(result.error?.message, "currency") ||
      isMissingColumnError(result.error?.message, "location_city") ||
      isMissingColumnError(result.error?.message, "location_country") ||
      isMissingColumnError(result.error?.message, "timeline_normalized") ||
      isMissingColumnError(result.error?.message, "preferred_visit_day") ||
      isMissingColumnError(result.error?.message, "preferred_visit_period") ||
      isMissingColumnError(result.error?.message, "appointment_status") ||
      isMissingColumnError(result.error?.message, "chat_locked") ||
      isMissingColumnError(result.error?.message, "lead_state") ||
      isMissingColumnError(result.error?.message, "hot_alert_sent") ||
      isMissingColumnError(result.error?.message, "last_message_at");

    if (!shouldRetry) {
      return result;
    }
  }

  return { error: lastError };
}

async function insertMessageCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  agencyId: string,
  leadId: string,
  role: "user" | "assistant",
  content: string,
) {
  const sender = role === "assistant" ? "ai" : "user";
  const timestamp = new Date().toISOString();
  let useAgencyColumn = true;

  let insertResult = await supabase.from("messages").insert({
    agency_id: agencyId,
    lead_id: leadId,
    sender,
    role,
    content,
    timestamp,
  });

  if (insertResult.error && isMissingAgencyIdColumnError(insertResult.error.message)) {
    useAgencyColumn = false;
    insertResult = await supabase.from("messages").insert({
      lead_id: leadId,
      sender,
      role,
      content,
      timestamp,
    });
  }

  if (!insertResult.error) {
    return insertResult;
  }

  if (isMissingSenderColumnError(insertResult.error.message)) {
    insertResult = await supabase
      .from("messages")
      .insert(
        useAgencyColumn
          ? {
              agency_id: agencyId,
              lead_id: leadId,
              role,
              content,
              timestamp,
            }
          : {
              lead_id: leadId,
              role,
              content,
              timestamp,
            },
      );

    if (!insertResult.error) {
      return insertResult;
    }
  }

  insertResult = await supabase
    .from("messages")
    .insert(
      useAgencyColumn
        ? {
            agency_id: agencyId,
            lead_id: leadId,
            sender,
            content,
            timestamp,
          }
        : {
            lead_id: leadId,
            sender,
            content,
            timestamp,
          },
    );

  if (!insertResult.error) {
    return insertResult;
  }

  return await supabase
    .from("messages")
    .insert(
      useAgencyColumn
        ? {
            agency_id: agencyId,
            lead_id: leadId,
            content,
            timestamp,
          }
        : {
            lead_id: leadId,
            content,
            timestamp,
          },
    );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { agencyApiKey, leadId, message, demoMode = false } = parsed.data;
    const requestUrl = new URL(request.url);
    const querySource = requestUrl.searchParams.get("source");
    const queryCampaignId = requestUrl.searchParams.get("campaign_id") || requestUrl.searchParams.get("campaignId");
    const normalizedSourceCandidate = (parsed.data.source || querySource || "").toLowerCase();
    const source: "facebook" | "google" | "organic" | null =
      normalizedSourceCandidate === "facebook" || normalizedSourceCandidate === "google" || normalizedSourceCandidate === "organic"
        ? normalizedSourceCandidate
        : null;
    const campaignId = (parsed.data.campaignId || queryCampaignId || "").trim() || null;
    const supabase = getServerSupabase();

    const agency = await resolveAgencyByApiKey(supabase, agencyApiKey);
    if (!agency) {
      return NextResponse.json({ error: "Invalid agency API key" }, { status: 401 });
    }

    let currentLeadId = leadId || null;

    if (!currentLeadId) {
      const initialState = demoMode ? DEMO_STATE : createInitialLeadState();
      const contact = demoMode ? DEMO_STATE.contact : null;
      const contactParts = getEmailAndPhone(contact);

      const leadInsertPayload = {
        agency_id: agency.id,
        source,
        campaign_id: campaignId,
        name: initialState.name,
        email: contactParts.email,
        phone: contactParts.phone,
        budget: initialState.budget ? String(initialState.budget) : null,
        budget_value: initialState.budget,
        currency: initialState.currency,
        location: initialState.location.raw,
        location_city: initialState.location.city,
        location_country: initialState.location.country,
        property_type: initialState.property_type,
        buying_timeline: initialState.timeline,
        timeline_normalized: initialState.timeline_normalized,
        status: initialState.status === "hot" ? "hot" : "cold",
        lead_state: initialState,
        chat_locked: false,
        last_message_at: new Date().toISOString(),
      };

      const { data: insertedLead, error: leadInsertError } = await insertLeadCompat(supabase, leadInsertPayload);

      if (leadInsertError || !insertedLead) {
        console.error("Unable to create lead", leadInsertError?.message || leadInsertError);
        return NextResponse.json({ error: "Unable to create lead" }, { status: 500 });
      }

      currentLeadId = insertedLead.id;
    }

    if (!currentLeadId) {
      return NextResponse.json({ error: "Unable to resolve lead id" }, { status: 500 });
    }

    await insertMessageCompat(supabase, agency.id, currentLeadId, "user", message);

    const { data: lead, error: leadLoadError } = await loadLeadCompat(supabase, currentLeadId, agency.id);

    if (leadLoadError) {
      console.error("Lead load failed", leadLoadError.message || leadLoadError);
      return NextResponse.json({ error: "Unable to load lead profile" }, { status: 500 });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.chat_locked || lead.appointment_status === "reserved" || hydrateState(lead as LeadDbRow).stage === "booked") {
      const finalLockedMessage =
        "✅ Your visit is already confirmed. Our agent will contact you shortly.";

      await insertMessageCompat(supabase, agency.id, currentLeadId, "assistant", finalLockedMessage);

      await supabase
        .from("leads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", currentLeadId)
        .eq("agency_id", agency.id);

      return NextResponse.json({
        leadId: currentLeadId,
        status: "hot",
        assistantMessage: finalLockedMessage,
        chatLocked: true,
      });
    }

    let baseState = hydrateState(lead as LeadDbRow);
    if (demoMode) {
      baseState = fillStateWithDefaults(baseState, DEMO_STATE);
    }

    const engine = applyUserInputToState(baseState, message);
    let state = engine.state;

    if (demoMode) {
      state = fillStateWithDefaults(state, DEMO_STATE);
    }

    const nextField = getNextFieldWithLoopGuard(state) || getNextRequiredField(state);
    let assistantMessage = "";
    let chatLocked = false;
    let appointmentStatus: "not_set" | "pending" | "reserved" = "not_set";
    let visitDay = lead.appointment_status === "pending" ? lead.preferred_visit_day : null;
    let visitPeriod = lead.appointment_status === "pending" ? lead.preferred_visit_period : null;

    if (engine.visitDay) {
      visitDay = engine.visitDay;
      appointmentStatus = "pending";
    }

    if (engine.visitPeriod) {
      visitPeriod = engine.visitPeriod;
      appointmentStatus = "pending";
    }

    let calendarLink: string | undefined;

    if (engine.invalidField) {
      assistantMessage = getInvalidFieldMessage(engine.invalidField);
    } else if (!hasAllMandatoryFields(state)) {
      if (nextField) {
        assistantMessage = getQuestionForField(nextField);
        state.last_question = nextField;
      }
    } else {
      state.stage = "closing";
      appointmentStatus = "pending";
      if (!visitDay) {
        assistantMessage = state.last_question === "timeline" ? getClosingDayFollowUpQuestion() : getClosingDayQuestion();
        state.last_question = "timeline";
      } else if (!visitPeriod) {
        assistantMessage = state.last_question === "timeline" ? getClosingPeriodFollowUpQuestion() : getClosingPeriodQuestion();
        state.last_question = "timeline";
      } else {
        state.status = "booked";
        state.stage = "booked";
        state.last_question = null;
        appointmentStatus = "reserved";
        chatLocked = true;
        const displayLocation = state.location.city || state.location.country || state.location.raw || "your preferred location";
        calendarLink = buildDynamicCalendarLink(visitDay, visitPeriod, displayLocation);
        const slot = resolveVisitSlot(visitDay, visitPeriod);
        assistantMessage = `✅ Visit confirmed for ${slot.displayLabel}. Our agent will contact you shortly.`;
      }
    }

    if (!assistantMessage) {
      assistantMessage = "Which city or area are you targeting?";
    }

    const contact = getEmailAndPhone(state.contact);
    const crmStatus = state.status === "booked" ? "hot" : state.status === "new" ? "cold" : state.status;

    const leadUpdatePayload = {
      source: lead.source || source,
      campaign_id: lead.campaign_id || campaignId,
      name: state.name,
      email: state.email || contact.email,
      phone: state.phone || contact.phone,
      budget: state.budget ? String(state.budget) : null,
      budget_value: state.budget,
      currency: state.currency,
      location: state.location.raw,
      location_city: state.location.city,
      location_country: state.location.country,
      property_type: state.property_type,
      buying_timeline: state.timeline,
      timeline_normalized: state.timeline_normalized,
      status: crmStatus,
      lead_state: state,
      preferred_visit_day: visitDay,
      preferred_visit_period: visitPeriod,
      appointment_status: appointmentStatus,
      chat_locked: chatLocked,
      last_message_at: new Date().toISOString(),
    };

    const { error: leadUpdateError } = await updateLeadCompat(supabase, currentLeadId, agency.id, leadUpdatePayload);

    if (leadUpdateError) {
      return NextResponse.json({ error: "Unable to update lead profile" }, { status: 500 });
    }

    await insertMessageCompat(supabase, agency.id, currentLeadId, "assistant", assistantMessage);

    if (
      crmStatus === "hot" &&
      !lead.hot_alert_sent &&
      state.contact &&
      state.budget &&
      (state.timeline_normalized === "asap" || state.timeline_normalized === "this_week")
    ) {
      const alert = await sendHotLeadAlertEmail({
        name: state.name,
        budget: engine.budgetLabel,
        location: state.location.city || state.location.country || state.location.raw,
        timeline: state.timeline,
      });

      if (alert.sent) {
        await supabase.from("leads").update({ hot_alert_sent: true }).eq("id", currentLeadId).eq("agency_id", agency.id);
      }
    }

    return NextResponse.json({
      leadId: currentLeadId,
      status: crmStatus,
      assistantMessage,
      chatLocked,
      calendarLink,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
