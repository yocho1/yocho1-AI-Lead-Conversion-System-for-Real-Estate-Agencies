import { DealPipelineKanban } from "@/components/deal-pipeline-kanban";

export default async function DealsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string }>;
}>) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Deals</h2>
        <p className="dashboard-subtitle">Manage stage movement and pipeline value with drag-and-drop controls.</p>
      </div>
      <DealPipelineKanban agencyApiKey={agencyApiKey} />
    </section>
  );
}
