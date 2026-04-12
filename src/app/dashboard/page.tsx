import { DashboardShell } from "@/components/dashboard-shell";
import { AnalyticsCard } from "@/components/analytics-card";
import { LeadsBoard } from "@/components/leads-board";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyKey?: string }>;
}) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";

  return (
    <DashboardShell>
      <h1 style={{ marginTop: "0.15rem" }}>Lead Dashboard</h1>
      <p style={{ color: "#4c617a" }}>Monitor incoming leads, qualification, and conversation history.</p>
      <AnalyticsCard agencyApiKey={agencyApiKey} />
      <LeadsBoard agencyApiKey={agencyApiKey} />
    </DashboardShell>
  );
}
