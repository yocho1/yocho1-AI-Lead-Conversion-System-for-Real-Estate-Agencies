import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

type DbMessage = {
  id: string;
  sender: "user" | "ai" | "agent";
  content: string;
  timestamp: string;
};

const postMessageSchema = z.object({
  agencyApiKey: z.string().min(4),
  sender: z.enum(["agent", "user"]).default("agent"),
  content: z.string().min(1),
  triggerAiReply: z.boolean().optional().default(false),
});

function sliceLatestSession(messages: DbMessage[]) {
  if (messages.length <= 1) return messages;

  const SESSION_GAP_MS = 30 * 60 * 1000;
  let sessionStart = 0;

  for (let i = 1; i < messages.length; i += 1) {
    const prevTs = new Date(messages[i - 1].timestamp).getTime();
    const currentTs = new Date(messages[i].timestamp).getTime();
    if (Number.isFinite(prevTs) && Number.isFinite(currentTs) && currentTs - prevTs > SESSION_GAP_MS) {
      sessionStart = i;
    }
  }

  return messages.slice(sessionStart);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const agencyApiKey = searchParams.get("agencyApiKey");

  if (!agencyApiKey) {
    return NextResponse.json({ error: "Missing agencyApiKey" }, { status: 400 });
  }

  const { leadId } = await params;
  const supabase = getServerSupabase();

  if (leadId === "demo-hot-lead") {
    return NextResponse.json({
      messages: [
        {
          id: "demo-msg-1",
          sender: "ai",
          content: "Which city or area are you targeting?",
          timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        },
        {
          id: "demo-msg-2",
          sender: "user",
          content: "Dubai Marina. Budget is 650k and I need an apartment this month.",
          timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
        {
          id: "demo-msg-3",
          sender: "ai",
          content: "Properties in your budget are moving fast this month. Perfect - you are ready to visit properties. What day works best this week?",
          timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
        },
        {
          id: "demo-msg-4",
          sender: "user",
          content: "Thursday afternoon.",
          timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        },
        {
          id: "demo-msg-5",
          sender: "ai",
          content: "✅ Visit confirmed for Thursday (afternoon). Our agent will contact you shortly.",
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        },
      ],
    });
  }

  const { data: agency } = await supabase.from("agencies").select("id").eq("api_key", agencyApiKey).single();
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agency.id).single();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender, role, content, timestamp")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  const normalizedMessages = ((messages || []) as Array<DbMessage & { role?: "user" | "assistant" | null }>).map((message) => ({
    id: message.id,
    sender: message.sender || (message.role === "assistant" ? "ai" : "user"),
    content: message.content,
    timestamp: message.timestamp,
  }));

  return NextResponse.json({ messages: sliceLatestSession(normalizedMessages) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = postMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }

  const { agencyApiKey, sender, content, triggerAiReply } = parsed.data;
  const { leadId } = await params;
  const supabase = getServerSupabase();

  const { data: agency } = await supabase.from("agencies").select("id").eq("api_key", agencyApiKey).single();
  if (!agency) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
  }

  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agency.id).single();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (sender === "user" && triggerAiReply) {
    const aiResponse = await fetch(new URL("/api/chat", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyApiKey,
        leadId,
        message: content,
      }),
    });

    const aiPayload = await aiResponse.json();
    if (!aiResponse.ok) {
      return NextResponse.json({ error: aiPayload.error || "Unable to process AI reply" }, { status: aiResponse.status });
    }

    return NextResponse.json({ ok: true, leadId, ai: aiPayload.assistantMessage || null });
  }

  const role = "user";
  const { error: messageInsertError } = await supabase.from("messages").insert({
    lead_id: leadId,
    sender,
    role,
    content,
    timestamp: new Date().toISOString(),
  });

  if (messageInsertError) {
    return NextResponse.json({ error: "Unable to store message" }, { status: 500 });
  }

  await supabase
    .from("leads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("agency_id", agency.id);

  return NextResponse.json({ ok: true, leadId });
}
