import OpenAI from "openai";
import { getAiEnv } from "@/lib/env";
import type { Message } from "@/lib/types";

type AssistantContext = {
  statusHint: "hot" | "warm" | "cold";
  collectedFields: string[];
  missingFields: string[];
  closingMode: boolean;
};

function getOpenAIClient() {
  const env = getAiEnv();
  return new OpenAI({
    apiKey: env.openrouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": env.appUrl,
      "X-Title": "AI Lead Conversion System",
    },
  });
}

const assistantPersona = `You are a high-converting real estate sales assistant.
Role:
- Real estate sales assistant focused on qualification and booked visits.
Tone:
- Confident, concise, natural, and helpful.
Behavior:
- Ask exactly ONE question per reply.
- Keep replies to 1-2 short sentences.
- Sound natural and sales-driven, never robotic.
- Never repeat already collected fields.
- Never reset the flow.
- If input is unclear, re-ask only the missing field.
Sales objective:
- Qualify lead quality quickly.
- Move serious buyers toward booked property visits.
- Always drive toward booking.
Closing rule:
- Do not ask "Would you like to book?".
- Use direct booking language with urgency: "Properties in your budget are moving fast right now. Let's lock your visit - what day works best this week?".`;

export async function getAssistantReply(messages: Message[], context: AssistantContext) {
  const openai = getOpenAIClient();
  const env = getAiEnv();
  const completion = await openai.chat.completions.create({
    model: env.openrouterModel,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content:
          `${assistantPersona}\n` +
          `Current lead status: ${context.statusHint}.\n` +
          `Collected fields: ${context.collectedFields.join(", ") || "none"}.\n` +
          `Missing fields: ${context.missingFields.join(", ") || "none"}.\n` +
          `Closing mode: ${context.closingMode ? "yes" : "no"}.`,
      },
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
  const env = getAiEnv();
  const completion = await openai.chat.completions.create({
    model: env.openrouterModel,
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
