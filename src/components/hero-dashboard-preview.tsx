import { Flame, TrendingUp, MessageSquareText, CalendarCheck2 } from "lucide-react";

export function HeroDashboardPreview() {
  return (
    <div className="hero-mockup-wrapper relative mx-auto w-full max-w-[560px]">
      <div className="hero-mockup-glow" aria-hidden />

      <article className="hero-mockup surface-card surface-glass relative overflow-hidden rounded-3xl border border-[color:color-mix(in_srgb,var(--secondary)_30%,var(--border))] p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">Live Conversion Board</p>
            <h3 className="m-0 mt-1 text-base font-semibold text-[var(--text)]">Today Performance</h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--cta)_50%,transparent)] bg-[color:color-mix(in_srgb,var(--cta)_16%,transparent)] px-2 py-1 text-[11px] font-semibold text-[var(--cta)]">
            <Flame size={12} /> HOT lead alert
          </span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-2)_82%,transparent)] p-3">
            <div className="mb-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-soft)]">
              <MessageSquareText size={12} /> Leads Qualified
            </div>
            <div className="text-2xl font-extrabold text-[var(--text)]">126</div>
            <div className="text-xs text-[var(--success)]">+18% this week</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-2)_82%,transparent)] p-3">
            <div className="mb-1 inline-flex items-center gap-1 text-[11px] text-[var(--text-soft)]">
              <CalendarCheck2 size={12} /> Visits Booked
            </div>
            <div className="text-2xl font-extrabold text-[var(--text)]">41</div>
            <div className="text-xs text-[var(--success)]">32.5% conversion</div>
          </div>
        </div>

        <div className="mb-3 rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-2)_78%,transparent)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--text-soft)]">
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={12} /> Pipeline Momentum
            </span>
            <span>Revenue intent score: 92/100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
            <div className="h-full w-[74%] rounded-full bg-[linear-gradient(90deg,var(--cta),var(--secondary))]" />
          </div>
        </div>

        <div className="grid gap-2">
          <div className="max-w-[92%] rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface-3)_84%,var(--surface))] px-3 py-2">
            <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-[var(--text-soft)]">AI Assistant</div>
            <div className="text-sm text-[var(--text)]">Properties in your budget are moving fast. Which day works for a visit this week?</div>
          </div>
          <div className="ml-auto max-w-[72%] rounded-2xl border border-transparent bg-[linear-gradient(120deg,var(--secondary),var(--primary))] px-3 py-2">
            <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-[#e2e8f0]">Buyer</div>
            <div className="text-sm text-white">Thursday afternoon. Budget 650k in Dubai Marina.</div>
          </div>
        </div>
      </article>
    </div>
  );
}
