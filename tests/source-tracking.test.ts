import { describe, expect, it } from "vitest";
import { computeSourceAnalytics, type SourceLeadRow } from "@/lib/source-analytics";

describe("source tracking analytics", () => {
  it("aggregates leads and conversion by source", () => {
    // Simulated created leads from mixed acquisition channels.
    const leads: SourceLeadRow[] = [
      { source: "facebook", appointment_status: "reserved", status: "hot" },
      { source: "facebook", appointment_status: "not_set", status: "cold" },
      { source: "google", appointment_status: "reserved", status: "hot" },
      { source: "google", appointment_status: "not_set", status: "warm" },
      { source: "google", appointment_status: "not_set", status: "cold" },
      { source: "organic", appointment_status: "reserved", status: "hot" },
      { source: null, appointment_status: "not_set", status: "cold" },
    ];

    const result = computeSourceAnalytics(leads);

    expect(result.items).toEqual([
      { source: "facebook", leads: 2, converted: 1, conversion_rate: 50 },
      { source: "google", leads: 3, converted: 1, conversion_rate: 33.33 },
      { source: "organic", leads: 1, converted: 1, conversion_rate: 100 },
      { source: "unknown", leads: 1, converted: 0, conversion_rate: 0 },
    ]);

    expect(result.totals.leads).toBe(7);
    expect(result.totals.converted).toBe(3);
    expect(result.totals.conversion_rate).toBeCloseTo(42.86, 2);
  });

  it("handles empty inputs without crashing", () => {
    const result = computeSourceAnalytics([]);

    expect(result.items.every((item) => item.leads === 0)).toBe(true);
    expect(result.totals).toEqual({
      leads: 0,
      converted: 0,
      conversion_rate: 0,
    });
  });
});
