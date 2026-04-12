import { NextResponse } from "next/server";
import { z } from "zod";
import { createGoogleCalendarLink } from "@/lib/calendar";
import { getAssistantReply } from "@/lib/ai";
import { extractLeadSignals } from "@/lib/lead-parser";
import { classifyLead } from "@/lib/qualification";
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

    const { data: agency } = await supabase.from("agencies").select("id, name").eq("api_key", agencyApiKey).single();

    if (!agency) {
      return NextResponse.json({ error: "Invalid agency API key" }, { status: 401 });
    }

    let currentLeadId = leadId || null;

    if (!currentLeadId) {
      const { data: insertedLead, error: leadInsertError } = await supabase
        .from("leads")
        .insert({
          agency_id: agency.id,
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
      .select("name, email, phone, budget, location, property_type, buying_timeline")
      .eq("id", currentLeadId)
      .single();

    const { data: conversation } = await supabase
      .from("messages")
      .select("id, lead_id, role, content, timestamp")
      .eq("lead_id", currentLeadId)
      .order("timestamp", { ascending: true });

    const conversationMessages = (conversation || []) as Message[];
    const allUserText = conversationMessages
      .filter((entry) => entry.role === "user")
      .map((entry) => entry.content)
      .join("\n");

    const extracted = extractLeadSignals(allUserText);
    const merged = mergeSignals((lead || {}) as Record<string, string | null>, extracted);
    const status = classifyLead(merged);

    const assistantText = await getAssistantReply(conversationMessages, status);
    const calendarLink = status === "hot" ? createGoogleCalendarLink(merged.location || "your selected area") : null;

    const assistantMessage = calendarLink
      ? `${assistantText}\n\nYou can book a property visit here: ${calendarLink}`
      : assistantText;

    await supabase.from("messages").insert({
      lead_id: currentLeadId,
      role: "assistant",
      content: assistantMessage,
    });

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
        status,
      })
      .eq("id", currentLeadId);

    return NextResponse.json({
      leadId: currentLeadId,
      status,
      assistantMessage,
      calendarLink,
    });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
