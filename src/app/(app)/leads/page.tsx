import { LeadsBoard } from "@/components/leads-board";

export default async function LeadsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Leads</h2>
        <p className="dashboard-subtitle">Review and qualify prospects in one focused workspace.</p>
      </div>
      <LeadsBoard agencyApiKey={agencyApiKey} demoMode={demoMode} />
    </section>
  );
}
