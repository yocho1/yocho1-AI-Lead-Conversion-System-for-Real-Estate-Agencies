import { Bot, Gauge, Timer, Sparkles, ChevronRight } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";

const METRICS = [
  {
    id: "qualification-rate",
    label: "Qualification rate",
    value: "78%",
    score: 78,
    suffix: "High intent fit",
    icon: Gauge,
    tone: "primary",
  },
  {
    id: "avg-response",
    label: "Avg response time",
    value: "1.2s",
    score: 88,
    suffix: "Fast reply engine",
    icon: Timer,
    tone: "speed",
  },
  {
    id: "ai-converted",
    label: "Leads converted by AI",
    value: "65%",
    score: 65,
    suffix: "Conversion attribution",
    icon: Sparkles,
    tone: "impact",
  },
] as const;

export function AIPerformanceBlock() {
  return (
    <SurfaceCard className="ai-performance-card mb-4 p-4 md:p-5">
      <header className="ai-performance-header mb-4">
        <div>
          <div className="ai-performance-eyebrow">
            <Bot size={12} /> AI Performance
          </div>
          <h3 className="ai-performance-title m-0">Model Efficiency and Conversion Impact</h3>
          <p className="m-0 mt-1 text-sm text-[var(--text-soft)]">Operational advantage from qualification speed, reply latency, and AI-attributed conversions.</p>
        </div>
        <span className="ai-performance-badge">DIFFERENTIATION</span>
      </header>

      <div className="ai-performance-layout">
        <aside className="ai-signal-rail">
          <div className="ai-signal-kicker">AI Edge</div>
          <div className="ai-signal-main">Top-tier autonomous lead handling</div>
          <p className="ai-signal-sub m-0">System is optimized for speed-to-qualification and conversion readiness.</p>
          <div className="ai-signal-foot">
            <span>Performance profile</span>
            <ChevronRight size={14} />
          </div>
        </aside>

        <div className="grid gap-2">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.id} className="ai-metric-item" data-tone={metric.tone}>
                <div className="ai-metric-topline">
                  <span className="ai-metric-icon">
                    <Icon size={14} />
                  </span>
                  <span className="ai-metric-label">{metric.label}</span>
                  <span className="ai-metric-value">{metric.value}</span>
                </div>
                <div className="ai-metric-progress" aria-hidden>
                  <span style={{ width: `${metric.score}%` }} />
                </div>
                <div className="ai-metric-caption">{metric.suffix}</div>
              </article>
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
}
