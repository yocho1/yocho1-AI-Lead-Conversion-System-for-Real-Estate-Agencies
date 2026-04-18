"use client";

import { Flame, MapPin, CalendarClock, Coins } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";

type LeadItem = {
  id: string;
  name: string | null;
  budget_value: number | null;
  budget: string | null;
  location: string | null;
  buying_timeline: string | null;
  status: "hot" | "warm" | "cold";
};

export function HotLeadsFocus({ leads }: Readonly<{ leads: LeadItem[] }>) {
  const hotLeads = leads
    .filter((lead) => lead.status === "hot")
    .sort((a, b) => (b.budget_value || 0) - (a.budget_value || 0))
    .slice(0, 3);

  return (
    <SurfaceCard className="hot-money-glow surface-glass mb-4 p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="m-0 text-lg font-semibold tracking-[-0.01em]">Hot Leads Focus</h3>
          <p className="m-0 mt-1 text-sm text-[var(--text-soft)]">Highest conversion probability this week</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] px-2 py-1 text-xs font-semibold text-[var(--accent)]">
          <Flame size={12} /> MONEY PRIORITY
        </span>
      </header>

      {hotLeads.length === 0 ? (
        <p className="m-0 text-sm text-[var(--text-soft)]">No hot leads yet. Once leads qualify, this block auto-prioritizes top opportunities.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {hotLeads.map((lead) => (
            <article
              key={lead.id}
              className="surface-card rounded-2xl border border-[color:color-mix(in_srgb,var(--cta)_45%,transparent)] bg-[linear-gradient(140deg,color-mix(in_srgb,var(--cta)_17%,transparent),color-mix(in_srgb,var(--accent)_16%,transparent))] p-4"
            >
              <div className="mb-2 text-sm font-semibold">{lead.name || "Unknown lead"}</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <Coins size={14} />
                  <span className="text-[var(--text)] font-semibold">
                    {lead.budget_value ? `$${lead.budget_value.toLocaleString()}` : lead.budget || "Budget pending"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <MapPin size={14} />
                  <span>{lead.location || "Location pending"}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--text-soft)]">
                  <CalendarClock size={14} />
                  <span>{lead.buying_timeline || "Timeline pending"}</span>
                </div>
              </div>
              <div className="mt-3 inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--cta)_45%,transparent)] bg-[color:color-mix(in_srgb,var(--cta)_18%,transparent)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--cta)]">
                Ready this week
              </div>
            </article>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
