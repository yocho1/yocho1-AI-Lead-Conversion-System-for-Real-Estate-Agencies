import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildDynamicCalendarLink,
  extractPreferredVisitDay,
  extractPreferredVisitPeriod,
} from "@/lib/appointment";
import {
  getMandatoryCaptureMessage,
  hasEnoughMessagesForMandatoryGate,
  isMandatoryInfoMissing,
} from "@/lib/chat-flow";
import { getAssistantReply } from "@/lib/ai";
import { extractLeadSignals } from "@/lib/lead-parser";
import { classifyLead } from "@/lib/qualification";
import {
  getMissingQualificationFields,
  getNextQualificationQuestion,
  shouldEnterClosingMode,
} from "@/lib/sales-flow";
import { getServerSupabase } from "@/lib/supabase";
import type { LeadSignals, Message } from "@/lib/types";

const payloadSchema = z.object({
  agencyApiKey: z.string().min(4),
  message: z.string().min(1),
  leadId: z.string().uuid().optional().nullable(),
});

function mergeSignals(lead: Record<string, string | null>, incoming: LeadSignals): LeadSignals {
  return {
    name: incoming.name || lead.name || undefined,
    email: incoming.email || lead.email || undefined,
    phone: incoming.phone || lead.phone || undefined,
    budget: incoming.budget || lead.budget || undefined,
    location: incoming.location || lead.location || undefined,
    propertyType: incoming.propertyType || lead.property_type || undefined,
    buyingTimeline: incoming.buyingTimeline || lead.buying_timeline || undefined,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { agencyApiKey, leadId, message } = parsed.data;
    const supabase = getServerSupabase();
    const incomingSignals = extractLeadSignals(message);

    const { data: agency } = await supabase.from("agencies").select("id, name").eq("api_key", agencyApiKey).single();

    if (!agency) {
      return NextResponse.json({ error: "Invalid agency API key" }, { status: 401 });
    }

    let currentLeadId = leadId || null;

    if (!currentLeadId && (incomingSignals.email || incomingSignals.phone)) {
      let dedupeQuery = supabase.from("leads").select("id").eq("agency_id", agency.id).order("created_at", { ascending: false }).limit(1);

      if (incomingSignals.email && incomingSignals.phone) {
        dedupeQuery = dedupeQuery.or(`email.eq.${incomingSignals.email},phone.eq.${incomingSignals.phone}`);
      } else if (incomingSignals.email) {
        dedupeQuery = dedupeQuery.eq("email", incomingSignals.email);
      } else if (incomingSignals.phone) {
        dedupeQuery = dedupeQuery.eq("phone", incomingSignals.phone);
      }

      const { data: existingLead } = await dedupeQuery.maybeSingle();
      if (existingLead?.id) {
        currentLeadId = existingLead.id;
      }
    }

    if (!currentLeadId) {
      const { data: insertedLead, error: leadInsertError } = await supabase
        .from("leads")
        .insert({
          agency_id: agency.id,
          name: incomingSignals.name || null,
          email: incomingSignals.email || null,
          phone: incomingSignals.phone || null,
          status: "cold",
        })
        .select("id")
        .single();

      if (leadInsertError || !insertedLead) {
        return NextResponse.json({ error: "Unable to create lead" }, { status: 500 });
      }

      currentLeadId = insertedLead.id;
    }

    await supabase.from("messages").insert({
      lead_id: currentLeadId,
      role: "user",
      content: message,
    });

    const { data: lead } = await supabase
      .from("leads")
      .select("name, email, phone, budget, location, property_type, buying_timeline, preferred_visit_day, preferred_visit_period, appointment_status")
      .eq("id", currentLeadId)
      .single();

    const { data: conversation } = await supabase
      .from("messages")
      .select("id, lead_id, role, content, timestamp")
      .eq("lead_id", currentLeadId)
      .order("timestamp", { ascending: true });

    const conversationMessages = (conversation || []) as Message[];
    const userMessageCount = conversationMessages.filter((entry) => entry.role === "user").length;
    const allUserText = conversationMessages
      .filter((entry) => entry.role === "user")
      .map((entry) => entry.content)
      .join("\n");

    const extracted = extractLeadSignals(allUserText);
    const merged = mergeSignals((lead || {}) as Record<string, string | null>, extracted);
    const mustCapture = isMandatoryInfoMissing(merged) && hasEnoughMessagesForMandatoryGate(userMessageCount);
    const status = mustCapture ? "cold" : classifyLead(merged);
    const visitDay = extractPreferredVisitDay(message) || lead?.preferred_visit_day || null;
    const visitPeriod = extractPreferredVisitPeriod(message) || lead?.preferred_visit_period || null;
    const isClosingMode = shouldEnterClosingMode(merged);
    const missingQualification = getMissingQualificationFields(merged);

    await supabase
      .from("leads")
      .update({
        name: merged.name || null,
        email: merged.email || null,
        phone: merged.phone || null,
        budget: merged.budget || null,
        location: merged.location || null,
        property_type: merged.propertyType || null,
        buying_timeline: merged.buyingTimeline || null,
        preferred_visit_day: visitDay,
        preferred_visit_period: visitPeriod,
        appointment_status: visitDay && visitPeriod ? "reserved" : isClosingMode ? "pending" : "not_set",
        status,
      })
      .eq("id", currentLeadId);

    if (mustCapture) {
      const captureMessage = getMandatoryCaptureMessage(merged);

      await supabase.from("messages").insert({
        lead_id: currentLeadId,
        role: "assistant",
        content: captureMessage,
      });

      return NextResponse.json({
        leadId: currentLeadId,
        status,
        assistantMessage: captureMessage,
        mandatoryCapturePending: true,
      });
    }

    const nextQualificationQuestion = getNextQualificationQuestion(missingQualification);
    if (nextQualificationQuestion) {
      await supabase.from("messages").insert({
        lead_id: currentLeadId,
        role: "assistant",
        content: nextQualificationQuestion,
      });

      return NextResponse.json({
        leadId: currentLeadId,
        status,
        assistantMessage: nextQualificationQuestion,
      });
    }

    if (isClosingMode) {
      if (!visitDay) {
        const closingAskDay =
          "Properties in your budget are moving fast this month. Perfect - you are ready to visit properties. What day works best for you this week?";

        await supabase.from("messages").insert({
          lead_id: currentLeadId,
          role: "assistant",
          content: closingAskDay,
        });

        return NextResponse.json({
          leadId: currentLeadId,
          status,
          assistantMessage: closingAskDay,
          closingMode: true,
        });
      }

      if (!visitPeriod) {
        const closingAskPeriod = "Great choice. Do you prefer a morning or afternoon property visit?";

        await supabase.from("messages").insert({
          lead_id: currentLeadId,
          role: "assistant",
          content: closingAskPeriod,
        });

        return NextResponse.json({
          leadId: currentLeadId,
          status,
          assistantMessage: closingAskPeriod,
          closingMode: true,
        });
      }

      const locationForCalendar = merged.location || "your preferred location";
      const calendarLink = buildDynamicCalendarLink(visitDay, visitPeriod, locationForCalendar);
      const reservationMessage =
        `Great, I have reserved a ${visitPeriod} slot on ${visitDay} for your property visits. ` +
        `Please confirm with this calendar link: ${calendarLink}`;

      await supabase.from("messages").insert({
        lead_id: currentLeadId,
        role: "assistant",
        content: reservationMessage,
      });

      await supabase
        .from("leads")
        .update({
          appointment_status: "reserved",
          preferred_visit_day: visitDay,
          preferred_visit_period: visitPeriod,
        })
        .eq("id", currentLeadId);

      return NextResponse.json({
        leadId: currentLeadId,
        status,
        assistantMessage: reservationMessage,
        calendarLink,
        closingMode: true,
      });
    }

    const collectedFields = [
      merged.name ? "name" : null,
      merged.email || merged.phone ? "contact" : null,
      merged.budget ? "budget" : null,
      merged.location ? "location" : null,
      merged.propertyType ? "property type" : null,
      merged.buyingTimeline ? "timeline" : null,
    ].filter(Boolean) as string[];

    const assistantMessage = await getAssistantReply(conversationMessages, {
      statusHint: status,
      collectedFields,
      missingFields: missingQualification,
      closingMode: false,
    });

    await supabase.from("messages").insert({
      lead_id: currentLeadId,
      role: "assistant",
      content: assistantMessage,
    });

    return NextResponse.json({
      leadId: currentLeadId,
      status,
      assistantMessage,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
