import { Bot, Clock3 } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";

export function ChatPreviewPanel() {
  const sample = [
    {
      id: "a1",
      role: "assistant",
      text: "Which city or area should I target for your property search?",
      ts: "09:02",
    },
    {
      id: "u1",
      role: "user",
      text: "Dubai Marina. Budget 650k, apartment, I want to move this month.",
      ts: "09:03",
    },
    {
      id: "a2",
      role: "assistant",
      text: "Perfect. You're a priority buyer. What day works best for your visit this week?",
      ts: "09:04",
    },
    {
      id: "u2",
      role: "user",
      text: "Thursday afternoon.",
      ts: "09:05",
    },
    {
      id: "a3",
      role: "assistant",
      text: "Visit confirmed for Thursday, 2:00 PM. Our agent is now assigned.",
      ts: "09:05",
    },
  ];

  return (
    <SurfaceCard className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-[1.02rem] font-semibold">AI Chat Preview</h3>
          <p className="m-0 mt-1 text-sm text-[var(--text-soft)]">High-converting real conversation path</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--cta)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--cta)_18%,transparent)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--cta)]">
          HOT lead converted
        </span>
      </div>

      <div className="grid gap-2">
        <div className="mb-1 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-soft)]">
          <Bot size={13} />
          <span>AI orchestrated conversation</span>
        </div>
        {sample.map((item) => (
          <div
            key={item.id}
            className="max-w-[92%] rounded-xl border border-[var(--border)] px-3 py-2"
            style={{
              color: item.role === "user" ? "#eff6ff" : "var(--text)",
              justifySelf: item.role === "user" ? "end" : "start",
              background:
                item.role === "user"
                  ? "linear-gradient(120deg, #2563eb, #1d4ed8)"
                  : "color-mix(in srgb, var(--surface-3) 82%, var(--surface))",
            }}
          >
            <div
              className="mb-1 flex items-center justify-between gap-2 text-[11px]"
              style={{ color: item.role === "user" ? "#bfdbfe" : "var(--text-soft)" }}
            >
              <span className="capitalize tracking-[0.04em]">{item.role === "assistant" ? "AI" : "Client"}</span>
              <span className="inline-flex items-center gap-1"><Clock3 size={11} /> {item.ts}</span>
            </div>
            <div className="text-sm leading-[1.45]">{item.text}</div>
          </div>
        ))}

        <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--text-soft)]">
          <span>AI typing</span>
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </SurfaceCard>
  );
}
