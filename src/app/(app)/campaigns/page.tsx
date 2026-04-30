export default function CampaignsPage() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Campaigns</h2>
        <p className="dashboard-subtitle">Measure channel performance and optimize growth spend allocation.</p>
      </div>

      <article className="surface-card p-6">
        <h3 className="m-0 text-lg font-semibold">Campaign Overview</h3>
        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">
          No campaigns connected yet. Add source tracking to unlock performance analytics.
        </p>
      </article>
    </section>
  );
}
