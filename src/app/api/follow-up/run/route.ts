import { NextResponse } from "next/server";
import { generateFollowUpMessage } from "@/lib/ai";
import { getServerEnv } from "@/lib/env";
import { getServerSupabase } from "@/lib/supabase";

export async function POST() {
  const env = getServerEnv();
  const supabase = getServerSupabase();

  const { data: leads } = await supabase.from("leads").select("id, location").order("created_at", { ascending: false });

  const now = Date.now();
  let sent = 0;

  for (const lead of leads || []) {
    const { data: recent } = await supabase
      .from("messages")
      .select("role, timestamp")
      .eq("lead_id", lead.id)
      .order("timestamp", { ascending: false })
      .limit(1);

    const latest = recent?.[0];
    if (!latest || latest.role !== "user") continue;

    const diffMinutes = (now - new Date(latest.timestamp).getTime()) / (1000 * 60);
    if (diffMinutes < env.followUpDelayMinutes) continue;

    const followUp = await generateFollowUpMessage(lead.location);

    await supabase.from("messages").insert({
      lead_id: lead.id,
      role: "assistant",
      content: followUp,
    });

    sent += 1;
  }

  return NextResponse.json({ sent, followUpDelayMinutes: env.followUpDelayMinutes });
}
