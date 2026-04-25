"use client";

import { use, useState } from "react";
import { AnalyticsCard, type AnalyticsLead } from "@/components/analytics-card";
import { AnalyticsSummaryPanel } from "@/components/analytics-summary-panel";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { AIPerformanceBlock } from "@/components/ai-performance-block";

export const dynamic = "force-dynamic";

type DashboardPageProps = Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>;

export default function DashboardPage(props: DashboardPageProps) {
  const params = use(props.searchParams);
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";
  const [analyticsLeads, setAnalyticsLeads] = useState<AnalyticsLead[]>([]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Revenue Overview</h2>
        <p className="dashboard-subtitle">Track performance, lead velocity, and operational health at a glance.</p>
      </div>

      <AnalyticsCard agencyApiKey={agencyApiKey} demoMode={demoMode} onLeadsLoaded={setAnalyticsLeads} />
      <AnalyticsSummaryPanel agencyApiKey={agencyApiKey} />
      <LiveActivityFeed leads={analyticsLeads} />
      <AIPerformanceBlock />
    </section>
  );
}
