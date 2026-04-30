"use client";

import { useEffect, useMemo, useState } from "react";
import { Gauge, LineChart, TimerReset } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";

type ChartPoint = { day: string; value: number };

type SummaryPayload = {
  summary: {
    funnel: {
      visitor: number;
      lead: number;
      qualified: number;
      booked: number;
    };
    conversion_rate: number;
    avg_response_time_seconds: number;
    avg_response_time_minutes: number;
    leads_per_day: number;
  };
  charts: {
    leads_over_time: ChartPoint[];
    conversion_percent: ChartPoint[];
  };
};

type AnalyticsSummaryPanelProps = Readonly<{
  agencyApiKey: string;
  days?: number;
}>;

function normalizeDayLabel(day: string) {
  const date = new Date(day);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function AnalyticsSummaryPanel({ agencyApiKey, days = 14 }: AnalyticsSummaryPanelProps) {
  const [payload, setPayload] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics/summary?agencyApiKey=${agencyApiKey}&days=${days}`);
        if (!response.ok) {
          throw new Error(`Unable to load analytics summary (${response.status})`);
        }
        const json = (await response.json()) as SummaryPayload;
        if (mounted) {
          setPayload(json);
        }
      } catch {
        if (mounted) {
          setPayload(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchSummary();
    const interval = window.setInterval(() => {
      void fetchSummary();
    }, 60_000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [agencyApiKey, days]);

  const leadsMax = useMemo(() => {
    const values = payload?.charts.leads_over_time.map((point) => point.value) || [];
    return Math.max(1, ...values);
  }, [payload]);

  const conversionMax = useMemo(() => {
    const values = payload?.charts.conversion_percent.map((point) => point.value) || [];
    return Math.max(1, ...values, 100);
  }, [payload]);

  return (
    <SurfaceCard className="mb-4 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[1.05rem] font-semibold tracking-[-0.01em]">Business Intelligence Layer</h3>
          <p className="m-0 mt-1 text-sm text-[var(--text-soft)]">Funnel progression, conversion ratio, and responsiveness for the last {days} days.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text-soft)]">
          <TimerReset size={14} /> Refreshing every 60s
        </div>
      </div>

      {loading || !payload ? (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="skeleton" style={{ height: "110px" }} />
          <div className="skeleton" style={{ height: "110px" }} />
          <div className="skeleton" style={{ height: "110px" }} />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <article className="kpi-card">
              <div className="flex items-center justify-between gap-2">
                <span className="kpi-label">Conversion Rate</span>
                <Gauge size={16} color="var(--secondary)" />
              </div>
              <div className="kpi-value" style={{ color: "var(--secondary)" }}>{payload.summary.conversion_rate.toFixed(2)}%</div>
            </article>
            <article className="kpi-card">
              <div className="flex items-center justify-between gap-2">
                <span className="kpi-label">Avg Response Time</span>
                <TimerReset size={16} color="var(--success)" />
              </div>
              <div className="kpi-value" style={{ color: "var(--success)", fontSize: "1.65rem" }}>
                {payload.summary.avg_response_time_minutes.toFixed(2)} min
              </div>
            </article>
            <article className="kpi-card">
              <div className="flex items-center justify-between gap-2">
                <span className="kpi-label">Leads Per Day</span>
                <LineChart size={16} color="var(--accent)" />
              </div>
              <div className="kpi-value" style={{ color: "var(--accent)" }}>{payload.summary.leads_per_day.toFixed(2)}</div>
            </article>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">Leads Over Time</div>
              <div className="grid gap-2">
                {payload.charts.leads_over_time.map((point) => {
                  const width = Math.round((point.value / leadsMax) * 100);
                  return (
                    <div key={point.day} className="grid items-center gap-2" style={{ gridTemplateColumns: "72px 1fr 36px" }}>
                      <span className="text-xs text-[var(--text-soft)]">{normalizeDayLabel(point.day)}</span>
                      <div className="h-[10px] overflow-hidden rounded-full bg-[var(--surface-3)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, background: "linear-gradient(90deg, #0ea5e9, #22c55e)" }}
                        />
                      </div>
                      <strong className="text-sm">{point.value}</strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">Conversion %</div>
              <div className="grid gap-2">
                {payload.charts.conversion_percent.map((point) => {
                  const width = Math.round((point.value / conversionMax) * 100);
                  return (
                    <div key={point.day} className="grid items-center gap-2" style={{ gridTemplateColumns: "72px 1fr 50px" }}>
                      <span className="text-xs text-[var(--text-soft)]">{normalizeDayLabel(point.day)}</span>
                      <div className="h-[10px] overflow-hidden rounded-full bg-[var(--surface-3)]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${width}%`, background: "linear-gradient(90deg, #f59e0b, #ef4444)" }}
                        />
                      </div>
                      <strong className="text-sm">{point.value.toFixed(1)}%</strong>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">Funnel</div>
            <div className="grid gap-3 sm:grid-cols-4">
              {([
                ["Visitors", payload.summary.funnel.visitor],
                ["Leads", payload.summary.funnel.lead],
                ["Qualified", payload.summary.funnel.qualified],
                ["Booked", payload.summary.funnel.booked],
              ] as const).map(([label, value]) => (
                <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-center">
                  <div className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-[var(--text-soft)]">{label}</div>
                  <div className="mt-1 text-2xl font-extrabold">{value}</div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </SurfaceCard>
  );
}
