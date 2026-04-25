export default function PropertiesPage() {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Properties</h2>
        <p className="dashboard-subtitle">Centralize listings inventory and map supply to active demand.</p>
      </div>

      <article className="surface-card p-6">
        <h3 className="m-0 text-lg font-semibold">Portfolio</h3>
        <p className="mb-0 mt-2 text-sm text-[var(--text-soft)]">
          No properties available yet. Add listings to start matching deals with inventory.
        </p>
      </article>
    </section>
  );
}
