import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

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
          role: "assistant",
          content: "Which city or area are you targeting?",
          timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
        },
        {
          id: "demo-msg-2",
          role: "user",
          content: "Dubai Marina. Budget is 650k and I need an apartment this month.",
          timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
        {
          id: "demo-msg-3",
          role: "assistant",
          content: "Properties in your budget are moving fast this month. Perfect - you are ready to visit properties. What day works best this week?",
          timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
        },
        {
          id: "demo-msg-4",
          role: "user",
          content: "Thursday afternoon.",
          timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        },
        {
          id: "demo-msg-5",
          role: "assistant",
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
    .select("id, role, content, timestamp")
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  const normalizedMessages = (messages || []) as DbMessage[];
  return NextResponse.json({ messages: sliceLatestSession(normalizedMessages) });
}
