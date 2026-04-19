import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase";

function normalizeWhatsappPhone(raw: string | null) {
  if (!raw) return null;
  return raw.replace(/^whatsapp:/i, "").trim();
}

function getFormDataText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function toXmlResponse(message: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const body = (getFormDataText(formData, "Body") || "").trim();
  const from = normalizeWhatsappPhone((getFormDataText(formData, "From") || "").trim());
  const profileName = (getFormDataText(formData, "ProfileName") || "").trim() || null;

  if (!body || !from) {
    return NextResponse.json({ error: "Missing Twilio payload fields" }, { status: 400 });
  }

  const agencyApiKey = (getFormDataText(formData, "agencyApiKey") || request.headers.get("x-agency-key") || "demo-agency-key").trim();
  const supabase = getServerSupabase();

  const { data: agency } = await supabase.from("agencies").select("id, api_key").eq("api_key", agencyApiKey).single();
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency API key" }, { status: 401 });
  }

  let leadId: string | null = null;

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("agency_id", agency.id)
    .eq("phone", from)
    .maybeSingle();

  if (existingLead?.id) {
    leadId = existingLead.id;
  } else {
    const { data: insertedLead, error: insertLeadError } = await supabase
      .from("leads")
      .insert({
        agency_id: agency.id,
        name: profileName,
        phone: from,
        status: "cold",
        last_message_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertLeadError || !insertedLead) {
      return NextResponse.json({ error: "Unable to create lead from webhook" }, { status: 500 });
    }
    leadId = insertedLead.id;
  }

  const env = getServerEnv();
  const chatResponse = await fetch(`${env.appUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agencyApiKey,
      leadId,
      message: body,
    }),
  });

  const chatPayload = await chatResponse.json().catch(() => ({}));
  if (!chatResponse.ok) {
    return NextResponse.json({ error: chatPayload.error || "Unable to process inbound message" }, { status: chatResponse.status });
  }

  const aiReply = String(chatPayload.assistantMessage || "Thanks, we received your message.");
  return toXmlResponse(aiReply);
}
