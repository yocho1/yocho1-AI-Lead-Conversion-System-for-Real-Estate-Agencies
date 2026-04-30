import { AutomationBuilderPanel } from "@/components/automation-builder-panel";

export default async function AutomationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string }>;
}>) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Automation</h2>
        <p className="dashboard-subtitle">Configure workflows and event-based actions for consistent conversion execution.</p>
      </div>
      <AutomationBuilderPanel agencyApiKey={agencyApiKey} />
    </section>
  );
}
