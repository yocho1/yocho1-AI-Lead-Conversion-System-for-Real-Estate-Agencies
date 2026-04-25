"use client";

import { use, useState } from "react";
import { AnalyticsCard, type AnalyticsLead } from "@/components/analytics-card";
import { AnalyticsSummaryPanel } from "@/components/analytics-summary-panel";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>;

export default function AnalyticsPage(props: AnalyticsPageProps) {
  const params = use(props.searchParams);
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";
  const [, setAnalyticsLeads] = useState<AnalyticsLead[]>([]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Analytics</h2>
        <p className="dashboard-subtitle">Analyze sources, conversion trends, and KPI momentum across your funnel.</p>
      </div>

      <AnalyticsCard agencyApiKey={agencyApiKey} demoMode={demoMode} onLeadsLoaded={setAnalyticsLeads} />
      <AnalyticsSummaryPanel agencyApiKey={agencyApiKey} />
    </section>
  );
}
