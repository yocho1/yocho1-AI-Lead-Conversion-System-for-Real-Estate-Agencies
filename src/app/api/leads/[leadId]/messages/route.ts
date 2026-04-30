import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyContext, resolveAgencyByApiKey } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

type DbMessage = {
  id: string;
  sender: "user" | "ai" | "agent";
  content: string;
  timestamp: string;
};

type MessageReadRow = {
  id: string;
  sender?: "user" | "ai" | "agent" | null;
  role?: "user" | "assistant" | null;
  content: string;
  timestamp: string;
};

const AGENT_MARKER = "[agent] ";

function buildDemoConversation(seed: string): DbMessage[] {
  return [
    {
      id: `${seed}-demo-msg-1`,
      sender: "ai",
      content: "Which city or area are you targeting?",
      timestamp: new Date(Date.now() - 1000 * 60 * 9).toISOString(),
    },
    {
      id: `${seed}-demo-msg-2`,
      sender: "user",
      content: "Dubai Marina. Budget is 650k and I need an apartment this month.",
      timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    },
    {
      id: `${seed}-demo-msg-3`,
      sender: "ai",
      content: "Properties in your budget are moving fast this month. Perfect - you are ready to visit properties. What day works best this week?",
      timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    },
    {
      id: `${seed}-demo-msg-4`,
      sender: "user",
      content: "Thursday afternoon.",
      timestamp: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
    },
    {
      id: `${seed}-demo-msg-5`,
      sender: "ai",
      content: "✅ Visit confirmed for Thursday (afternoon). Our agent will contact you shortly.",
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ];
}

const postMessageSchema = z.object({
  agencyApiKey: z.string().min(4).optional(),
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

function mapRoleToSender(role: "user" | "assistant" | null | undefined): "user" | "ai" | "agent" {
  if (role === "assistant") return "ai";
  return "user";
}

function encodeContentForFallback(sender: "user" | "ai" | "agent", content: string): string {
  if (sender !== "agent") return content;
  if (content.toLowerCase().startsWith(AGENT_MARKER)) return content;
  return `${AGENT_MARKER}${content}`;
}

function decodeSenderAndContent(row: MessageReadRow): { sender: "user" | "ai" | "agent"; content: string } {
  const rawContent = row.content || "";

  if (row.sender) {
    if (row.sender === "agent" && rawContent.toLowerCase().startsWith(AGENT_MARKER)) {
      return { sender: "agent", content: rawContent.slice(AGENT_MARKER.length) };
    }
    return { sender: row.sender, content: rawContent };
  }

  if (rawContent.toLowerCase().startsWith(AGENT_MARKER)) {
    return { sender: "agent", content: rawContent.slice(AGENT_MARKER.length) };
  }

  return { sender: mapRoleToSender(row.role), content: rawContent };
}

async function readMessagesCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  leadId: string,
  agencyId: string,
): Promise<DbMessage[]> {
  const mapRows = (rows: MessageReadRow[]) =>
    rows.map((row) => ({
      id: row.id,
      sender: decodeSenderAndContent(row).sender,
      content: decodeSenderAndContent(row).content,
      timestamp: row.timestamp,
    }));

  let senderQuery = await supabase
    .from("messages")
    .select("id,sender,content,timestamp")
    .eq("agency_id", agencyId)
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  if (senderQuery.error && isMissingAgencyIdColumnError(senderQuery.error.message)) {
    senderQuery = await supabase
      .from("messages")
      .select("id,sender,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });
  }

  if (!senderQuery.error) {
    const senderRows = (senderQuery.data || []) as MessageReadRow[];
    if (senderRows.length > 0) {
      return mapRows(senderRows);
    }

    const senderUnscopedQuery = await supabase
      .from("messages")
      .select("id,sender,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });

    if (!senderUnscopedQuery.error) {
      return mapRows((senderUnscopedQuery.data || []) as MessageReadRow[]);
    }
  }

  let roleQuery = await supabase
    .from("messages")
    .select("id,role,content,timestamp")
    .eq("agency_id", agencyId)
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  if (roleQuery.error && isMissingAgencyIdColumnError(roleQuery.error.message)) {
    roleQuery = await supabase
      .from("messages")
      .select("id,role,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });
  }

  if (!roleQuery.error) {
    const roleRows = (roleQuery.data || []) as MessageReadRow[];
    if (roleRows.length > 0) {
      return mapRows(roleRows);
    }

    const roleUnscopedQuery = await supabase
      .from("messages")
      .select("id,role,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });

    if (!roleUnscopedQuery.error) {
      return mapRows((roleUnscopedQuery.data || []) as MessageReadRow[]);
    }
  }

  let minimalQuery = await supabase
    .from("messages")
    .select("id,content,timestamp")
    .eq("agency_id", agencyId)
    .eq("lead_id", leadId)
    .order("timestamp", { ascending: true });

  if (minimalQuery.error && isMissingAgencyIdColumnError(minimalQuery.error.message)) {
    minimalQuery = await supabase
      .from("messages")
      .select("id,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });
  }

  if (!minimalQuery.error) {
    const minimalRows = (minimalQuery.data || []) as MessageReadRow[];
    if (minimalRows.length > 0) {
      return mapRows(minimalRows);
    }

    const minimalUnscopedQuery = await supabase
      .from("messages")
      .select("id,content,timestamp")
      .eq("lead_id", leadId)
      .order("timestamp", { ascending: true });

    if (!minimalUnscopedQuery.error) {
      return mapRows((minimalUnscopedQuery.data || []) as MessageReadRow[]);
    }
  }

  return [];
}

async function insertMessageCompat(
  supabase: ReturnType<typeof getServerSupabase>,
  agencyId: string,
  leadId: string,
  sender: "user" | "ai" | "agent",
  role: "user" | "assistant",
  content: string,
) {
  const timestamp = new Date().toISOString();
  const fallbackContent = encodeContentForFallback(sender, content);
  let useAgencyColumn = true;

  let bothInsert = await supabase
    .from("messages")
    .insert({ agency_id: agencyId, lead_id: leadId, sender, role, content, timestamp })
    .select("id,sender,role,content,timestamp")
    .single();

  if (bothInsert.error && isMissingAgencyIdColumnError(bothInsert.error.message)) {
    useAgencyColumn = false;
    bothInsert = await supabase
      .from("messages")
      .insert({ lead_id: leadId, sender, role, content, timestamp })
      .select("id,sender,role,content,timestamp")
      .single();
  }

  if (!bothInsert.error && bothInsert.data) {
    return {
      message: {
        id: bothInsert.data.id,
        sender: bothInsert.data.sender || mapRoleToSender(bothInsert.data.role),
        content: bothInsert.data.content,
        timestamp: bothInsert.data.timestamp,
      } as DbMessage,
      error: null,
    };
  }

  const roleInsert = await supabase
    .from("messages")
    .insert(useAgencyColumn ? { agency_id: agencyId, lead_id: leadId, role, content: fallbackContent, timestamp } : { lead_id: leadId, role, content: fallbackContent, timestamp })
    .select("id,role,content,timestamp")
    .single();

  if (!roleInsert.error && roleInsert.data) {
    return {
      message: {
        id: roleInsert.data.id,
        sender: decodeSenderAndContent(roleInsert.data).sender,
        content: decodeSenderAndContent(roleInsert.data).content,
        timestamp: roleInsert.data.timestamp,
      } as DbMessage,
      error: null,
    };
  }

  const senderInsert = await supabase
    .from("messages")
    .insert(useAgencyColumn ? { agency_id: agencyId, lead_id: leadId, sender, content, timestamp } : { lead_id: leadId, sender, content, timestamp })
    .select("id,sender,content,timestamp")
    .single();

  if (!senderInsert.error && senderInsert.data) {
    return {
      message: {
        id: senderInsert.data.id,
        sender: senderInsert.data.sender || sender,
        content: senderInsert.data.content,
        timestamp: senderInsert.data.timestamp,
      } as DbMessage,
      error: null,
    };
  }

  const minimalInsert = await supabase
    .from("messages")
    .insert(useAgencyColumn ? { agency_id: agencyId, lead_id: leadId, content: fallbackContent, timestamp } : { lead_id: leadId, content: fallbackContent, timestamp })
    .select("id,content,timestamp")
    .single();

  if (!minimalInsert.error && minimalInsert.data) {
    return {
      message: {
        id: minimalInsert.data.id,
        sender: decodeSenderAndContent(minimalInsert.data).sender,
        content: decodeSenderAndContent(minimalInsert.data).content,
        timestamp: minimalInsert.data.timestamp,
      } as DbMessage,
      error: null,
    };
  }

  return {
    message: null,
    error: bothInsert.error || roleInsert.error || senderInsert.error || minimalInsert.error,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> },
) {
  const { searchParams } = new URL(request.url);
  const latestOnly = searchParams.get("latestSessionOnly") === "true";

  const { leadId } = await params;
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

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

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("agency_id", agencyContext.agencyId)
    .single();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const normalizedMessages = await readMessagesCompat(supabase, leadId, agencyContext.agencyId);

  const messages = latestOnly ? sliceLatestSession(normalizedMessages) : normalizedMessages;
  return NextResponse.json({ messages });
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

  if (leadId === "demo-hot-lead") {
    if (sender === "user" && triggerAiReply) {
      return NextResponse.json({
        ok: true,
        leadId,
        ai: "Thanks for your message. A demo AI reply was generated.",
      });
    }

    return NextResponse.json({
      ok: true,
      leadId,
      message: {
        id: `demo-msg-${Date.now()}`,
        sender,
        content,
        timestamp: new Date().toISOString(),
      },
    });
  }

  let agencyId = "";
  let normalizedAgencyApiKey = "";

  if (agencyApiKey) {
    const agencyByBodyKey = await resolveAgencyByApiKey(supabase, agencyApiKey);
    if (!agencyByBodyKey) {
      return NextResponse.json({ error: "Invalid agency key" }, { status: 401 });
    }
    agencyId = agencyByBodyKey.id;
    normalizedAgencyApiKey = agencyByBodyKey.api_key;
  } else {
    const agencyContext = await requireAgencyContext(request, supabase);
    if (agencyContext instanceof NextResponse) {
      return agencyContext;
    }
    agencyId = agencyContext.agencyId;
    normalizedAgencyApiKey = agencyContext.agencyApiKey;
  }

  const { data: lead } = await supabase.from("leads").select("id").eq("id", leadId).eq("agency_id", agencyId).single();
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (sender === "user" && triggerAiReply) {
    const aiResponse = await fetch(new URL("/api/chat", request.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyApiKey: normalizedAgencyApiKey,
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
  const insertResult = await insertMessageCompat(supabase, agencyId, leadId, sender, role, content);
  const insertedMessage = insertResult.message;
  const messageInsertError = insertResult.error;

  if (messageInsertError) {
    return NextResponse.json({ error: `Unable to store message: ${messageInsertError.message}` }, { status: 500 });
  }

  await supabase
    .from("leads")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("agency_id", agencyId);

  return NextResponse.json({ ok: true, leadId, message: insertedMessage });
}
