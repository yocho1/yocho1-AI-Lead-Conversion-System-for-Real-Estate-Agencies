import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import type { Message } from "@/lib/types";

function getOpenAIClient() {
  const env = getServerEnv();
  return new OpenAI({ apiKey: env.openaiApiKey });
}

const assistantPersona = `You are an elite real estate sales assistant for a property agency.
Tone rules:
- Professional, concise, and persuasive.
- Never sound like a generic chatbot.
- Focus on qualifying the lead and moving toward booking a property visit.
- Ask at most one follow-up question each turn.
Required fields to collect: name, email or phone, budget, preferred location, property type, buying timeline.
When the lead appears serious and complete, suggest booking a visit.`;

export async function getAssistantReply(messages: Message[], statusHint: "hot" | "warm" | "cold") {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: `${assistantPersona}\nCurrent lead status: ${statusHint}.` },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "Could you share a bit more about the property you're looking for?";
}

export async function generateFollowUpMessage(location: string | null) {
  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "Write one short follow-up message for a paused real estate lead. Keep it polite, sales-focused, and under 25 words.",
      },
      {
        role: "user",
        content: `Lead preferred location: ${location || "not provided"}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || "Are you still looking for a property? I can share matching options and help you book a visit.";
}
