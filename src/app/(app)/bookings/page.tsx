"use client";

import { use, useEffect, useState } from "react";

export const dynamic = "force-dynamic";

type BookingLead = {
  id: string;
  name: string | null;
  phone: string | null;
  location_city: string | null;
  preferred_visit_day: string | null;
  preferred_visit_period: string | null;
};

export default function BookingsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string }>;
}>) {
  const params = use(searchParams);
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const [bookings, setBookings] = useState<BookingLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/leads?agencyApiKey=${agencyApiKey}`);
        const payload = await res.json();
        const leads = Array.isArray(payload.leads) ? payload.leads : [];
        const reserved = leads.filter((lead: { appointment_status?: string }) => lead.appointment_status === "reserved");

        if (mounted) {
          setBookings(reserved);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [agencyApiKey]);

  return (
    <section className="space-y-5">
      <div>
        <h2 className="dashboard-title">Bookings</h2>
        <p className="dashboard-subtitle">Track confirmed visits and keep your field teams synchronized.</p>
      </div>

      <article className="surface-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-[var(--text-soft)]">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="p-6 text-sm text-[var(--text-soft)]">No confirmed bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-left text-xs uppercase tracking-[0.08em] text-[var(--text-soft)]">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3">Visit Day</th>
                  <th className="px-4 py-3">Period</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--border)] text-sm">
                    <td className="px-4 py-3 font-medium">{lead.name || "Unknown"}</td>
                    <td className="px-4 py-3">{lead.phone || "-"}</td>
                    <td className="px-4 py-3">{lead.location_city || "-"}</td>
                    <td className="px-4 py-3">{lead.preferred_visit_day || "-"}</td>
                    <td className="px-4 py-3">{lead.preferred_visit_period || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}
