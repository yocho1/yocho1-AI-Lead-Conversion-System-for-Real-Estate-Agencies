"use client";

import { FormEvent, useMemo, useState } from "react";
import { MessageCircle, SendHorizontal } from "lucide-react";

type UiMessage = {
  role: "user" | "assistant";
  content: string;
};

interface ChatWidgetProps {
  agencyApiKey: string;
  demoMode?: boolean;
}

const demoConversation: UiMessage[] = [
  {
    role: "assistant",
    content: "Hi, I can help you secure the best property deals fast. What area and budget are you targeting?",
  },
  {
    role: "user",
    content: "I need a 2-bedroom apartment in Dubai Marina around $550k. Timeline is this month.",
  },
  {
    role: "assistant",
    content:
      "Perfect. Properties in that budget are moving fast this month. You're ready to visit. What day works best for you this week?",
  },
  {
    role: "user",
    content: "Thursday afternoon.",
  },
  {
    role: "assistant",
    content: "Great, I've reserved your visit slot for Thursday afternoon. I can now match your top 3 options.",
  },
];

export function ChatWidget({ agencyApiKey, demoMode = false }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>(
    demoMode
      ? demoConversation
      : [
          {
            role: "assistant",
            content:
              "Hello, I can help you find the right property quickly. What location and budget are you considering?",
          },
        ],
  );
  const [isTyping, setIsTyping] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !isTyping, [input, isTyping]);

  const streamAssistant = (text: string) => {
    let index = 0;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const interval = setInterval(() => {
      index += 3;
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last) {
          last.content = text.slice(0, index);
        }
        return copy;
      });
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, 16);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSend) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agencyApiKey,
          leadId,
          message: userMessage,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to process chat message");
      }

      if (data.leadId) {
        setLeadId(data.leadId);
      }

      streamAssistant(data.assistantMessage);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I ran into an issue. Please try again in a few seconds.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: "1.25rem",
          bottom: "1.25rem",
          width: "64px",
          height: "64px",
          borderRadius: "999px",
          background: "linear-gradient(130deg, #0f766e, #115e59)",
          color: "#fff",
          border: "none",
          boxShadow: "0 10px 30px rgba(17, 94, 89, 0.45)",
          cursor: "pointer",
          zIndex: 40,
        }}
        aria-label="Open chat"
      >
        <MessageCircle style={{ marginTop: "0.2rem" }} />
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: "1.25rem",
            bottom: "6rem",
            width: "min(390px, calc(100vw - 2rem))",
            background: "#fff",
            borderRadius: "18px",
            border: "1px solid #d6deea",
            boxShadow: "0 20px 45px rgba(13, 36, 64, 0.18)",
            overflow: "hidden",
            zIndex: 40,
          }}
        >
          <div
            style={{
              padding: "0.9rem 1rem",
              background: "linear-gradient(120deg, #0f766e, #0f4f56)",
              color: "#ecfeff",
              fontWeight: 600,
            }}
          >
            Property Assistant
          </div>

          {demoMode && (
            <div style={{ padding: "0.45rem 0.75rem", background: "#ecfdf5", color: "#065f46", fontSize: "0.8rem" }}>
              Demo mode preloaded: hot-lead booking scenario
            </div>
          )}

          <div style={{ height: "360px", overflowY: "auto", padding: "0.75rem" }}>
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                style={{
                  marginBottom: "0.7rem",
                  display: "flex",
                  justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "0.55rem 0.7rem",
                    borderRadius: "12px",
                    fontSize: "0.92rem",
                    lineHeight: 1.35,
                    background: message.role === "user" ? "#0f766e" : "#eef2ff",
                    color: message.role === "user" ? "#ecfeff" : "#23364d",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && <div style={{ fontSize: "0.85rem", color: "#4c617a" }}>Assistant is typing...</div>}
          </div>

          <form onSubmit={onSubmit} style={{ borderTop: "1px solid #e4e9f3", display: "flex", padding: "0.6rem" }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type your message..."
              style={{
                flex: 1,
                border: "1px solid #d6deea",
                borderRadius: "11px",
                padding: "0.55rem 0.7rem",
                fontSize: "0.9rem",
              }}
            />
            <button
              type="submit"
              disabled={!canSend}
              style={{
                marginLeft: "0.45rem",
                border: "none",
                borderRadius: "10px",
                width: "40px",
                background: canSend ? "#0f766e" : "#94a3b8",
                color: "#fff",
                cursor: canSend ? "pointer" : "not-allowed",
              }}
            >
              <SendHorizontal size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
