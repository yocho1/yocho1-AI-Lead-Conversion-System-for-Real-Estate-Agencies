"use client";

import { useEffect, useState } from "react";

type Point = { day: string; count: number };

export function AnalyticsCard({ agencyApiKey }: { agencyApiKey: string }) {
  const [series, setSeries] = useState<Point[]>([]);

  useEffect(() => {
    const fetchSeries = async () => {
      const response = await fetch(`/api/analytics/leads-per-day?agencyApiKey=${agencyApiKey}`);
      const data = await response.json();
      setSeries(data.series || []);
    };

    void fetchSeries();
  }, [agencyApiKey]);

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Leads Per Day</h3>
      {series.length === 0 ? (
        <p style={{ color: "#4c617a" }}>No leads yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          {series.map((point) => (
            <div key={point.day} style={{ display: "grid", gridTemplateColumns: "110px 1fr 45px", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.84rem", color: "#4c617a" }}>{point.day}</span>
              <div style={{ background: "#e2e8f0", height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(point.count * 20, 100)}%`, background: "#0f766e", height: "100%" }} />
              </div>
              <strong>{point.count}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
