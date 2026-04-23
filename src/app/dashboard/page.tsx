"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsCard, type AnalyticsLead } from "@/components/analytics-card";
import { LeadsBoard } from "@/components/leads-board";
import { ChatPreviewPanel } from "@/components/chat-preview-panel";
import { HotLeadsFocus } from "@/components/hot-leads-focus";
import { LiveActivityFeed } from "@/components/live-activity-feed";
import { AIPerformanceBlock } from "@/components/ai-performance-block";
import { AnalyticsSummaryPanel } from "@/components/analytics-summary-panel";
import { AutomationBuilderPanel } from "@/components/automation-builder-panel";
import { DealPipelineKanban } from "@/components/deal-pipeline-kanban";
import { use, useState } from "react";

type DashboardPageProps = Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>;

export default function DashboardPage(props: DashboardPageProps) {
  const params = use(props.searchParams);
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";
  const [analyticsLeads, setAnalyticsLeads] = useState<AnalyticsLead[]>([]);

  return (
    <DashboardShell>
      <h1 className="dashboard-title">Dashboard</h1>
      <p className="dashboard-subtitle">Monitor lead velocity, conversion momentum, and AI-driven qualification in one enterprise command center.</p>
      <AnalyticsCard agencyApiKey={agencyApiKey} demoMode={demoMode} onLeadsLoaded={setAnalyticsLeads} />
      <AnalyticsSummaryPanel agencyApiKey={agencyApiKey} />
      <LiveActivityFeed leads={analyticsLeads} />
      <AIPerformanceBlock />
      <AutomationBuilderPanel agencyApiKey={agencyApiKey} />
      <DealPipelineKanban agencyApiKey={agencyApiKey} />
      <HotLeadsFocus leads={analyticsLeads} />
      <ChatPreviewPanel />
      <LeadsBoard agencyApiKey={agencyApiKey} demoMode={demoMode} />
    </DashboardShell>
  );
}
