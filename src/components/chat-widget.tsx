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
  const [chatLocked, setChatLocked] = useState(false);

  const canSend = useMemo(() => input.trim().length > 0 && !isTyping && !chatLocked, [input, isTyping, chatLocked]);

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
          demoMode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to process chat message");
      }

      if (data.leadId) {
        setLeadId(data.leadId);
      }

      if (data.chatLocked) {
        setChatLocked(true);
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
          background: "linear-gradient(130deg, var(--cta), var(--cta-dark))",
          color: "#fff7ed",
          border: "none",
          boxShadow: "0 10px 30px color-mix(in srgb, var(--cta) 45%, transparent)",
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
            background: "color-mix(in srgb, var(--surface) 88%, transparent)",
            borderRadius: "18px",
            border: "1px solid color-mix(in srgb, var(--border) 84%, transparent)",
            boxShadow: "0 20px 45px rgba(13, 36, 64, 0.18)",
            backdropFilter: "blur(10px)",
            overflow: "hidden",
            zIndex: 40,
          }}
        >
          <div
            style={{
              padding: "0.9rem 1rem",
              background: "linear-gradient(120deg, var(--secondary), #8b5cf6)",
              color: "#eef2ff",
              fontWeight: 600,
            }}
          >
            Property Assistant
          </div>

          {demoMode && (
            <div
              style={{
                padding: "0.45rem 0.75rem",
                background: "color-mix(in srgb, var(--cta) 18%, transparent)",
                color: "var(--text)",
                fontSize: "0.8rem",
              }}
            >
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
                    background:
                      message.role === "user"
                        ? "linear-gradient(120deg, var(--secondary), var(--primary))"
                        : "color-mix(in srgb, var(--surface-3) 80%, var(--surface))",
                    color: message.role === "user" ? "#eff6ff" : "var(--text)",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isTyping && <div style={{ fontSize: "0.85rem", color: "var(--text-soft)" }}>Assistant is typing...</div>}
          </div>

          <form onSubmit={onSubmit} style={{ borderTop: "1px solid var(--border)", display: "flex", padding: "0.6rem" }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={chatLocked ? "Visit confirmed. Chat is now closed." : "Type your message..."}
              disabled={chatLocked}
              style={{
                flex: 1,
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
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
                background: canSend ? "linear-gradient(120deg, var(--cta), var(--cta-dark))" : "#94a3b8",
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
