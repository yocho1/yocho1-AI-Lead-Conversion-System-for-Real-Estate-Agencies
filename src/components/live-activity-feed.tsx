"use client";

import { Activity, CalendarCheck2, Flame, Sparkles } from "lucide-react";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { AnalyticsLead } from "@/components/analytics-card";

function currencyLabel(lead?: AnalyticsLead) {
  if (!lead) return "$120K";
  if (lead.budget_value) return `$${Math.round(lead.budget_value / 1000)}K`;
  return lead.budget || "$120K";
}

export function LiveActivityFeed({ leads }: Readonly<{ leads: AnalyticsLead[] }>) {
  const hotLead = leads.find((lead) => lead.status === "hot");
  const bookedLead = leads.find((lead) => lead.appointment_status === "reserved");

  const events = [
    {
      id: "event-hot",
      icon: Flame,
      tone: "danger",
      text: `New HOT lead - ${hotLead?.location || "Casablanca"} - ${currencyLabel(hotLead)}`,
    },
    {
      id: "event-visit",
      icon: CalendarCheck2,
      tone: "warm",
      text: `Visit booked - ${bookedLead?.location || "Dubai Marina"}`,
    },
    {
      id: "event-ai",
      icon: Sparkles,
      tone: "ai",
      text: "AI converted lead in 2 min",
    },
  ] as const;

  return (
    <SurfaceCard className="live-activity-card mb-4 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-[1.02rem] font-semibold">Live Activity</h3>
        <span className="live-activity-badge">
          <span className="live-activity-dot" />
          LIVE
        </span>
      </div>

      <div className="grid gap-2">
        {events.map((event) => {
          const Icon = event.icon;
          return (
            <article key={event.id} className="live-activity-item" data-tone={event.tone}>
              <span className="live-activity-icon">
                <Icon size={13} />
              </span>
              <p className="m-0 text-sm leading-[1.4]">
                + {event.text}
              </p>
              <Activity size={12} className="live-activity-wave" />
            </article>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
