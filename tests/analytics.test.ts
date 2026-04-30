import { describe, expect, it } from "vitest";
import { computeAnalytics, type LeadAnalyticsRow, type MessageAnalyticsRow, type VisitorEventRow } from "@/lib/analytics";

describe("analytics computation", () => {
  it("computes funnel metrics and response time accurately", () => {
    const now = Date.now();
    const isoDaysAgo = (daysAgo: number, minuteOffset = 0) =>
      new Date(now - daysAgo * 24 * 60 * 60 * 1000 + minuteOffset * 60 * 1000).toISOString();

    const leads: LeadAnalyticsRow[] = [
      {
        id: "lead-1",
        created_at: isoDaysAgo(3),
        status: "hot",
        appointment_status: "reserved",
        lead_state: { status: "booked", stage: "booked" },
      },
      {
        id: "lead-2",
        created_at: isoDaysAgo(2),
        status: "warm",
        appointment_status: "pending",
        lead_state: { status: "warm", stage: "closing" },
      },
      {
        id: "lead-3",
        created_at: isoDaysAgo(1),
        status: "cold",
        appointment_status: "not_set",
        lead_state: { status: "cold", stage: "collecting" },
      },
      {
        id: "lead-4",
        created_at: isoDaysAgo(1, 2),
        status: "hot",
        appointment_status: "not_set",
        lead_state: { status: "hot", stage: "closing" },
      },
    ];

    const messages: MessageAnalyticsRow[] = [
      { lead_id: "lead-1", timestamp: isoDaysAgo(3, 10), sender: "user", role: "user", content: "Hi" },
      { lead_id: "lead-1", timestamp: isoDaysAgo(3, 12), sender: "ai", role: "assistant", content: "Hello" },
      { lead_id: "lead-2", timestamp: isoDaysAgo(2, 20), sender: "user", role: "user", content: "Need a villa" },
      { lead_id: "lead-2", timestamp: isoDaysAgo(2, 23), sender: "agent", role: "assistant", content: "We can help" },
      { lead_id: "lead-3", timestamp: isoDaysAgo(1, 8), sender: "user", role: "user", content: "Budget 100k" },
      { lead_id: "lead-3", timestamp: isoDaysAgo(1, 10), sender: "ai", role: "assistant", content: "Thanks" },
    ];

    const visitorEvents: VisitorEventRow[] = [
      { created_at: isoDaysAgo(3), event_type: "visitor_page_view" },
      { created_at: isoDaysAgo(2), event_type: "visitor_page_view" },
      { created_at: isoDaysAgo(1), event_type: "visitor_page_view" },
      { created_at: isoDaysAgo(1, 2), event_type: "visitor_page_view" },
    ];

    const result = computeAnalytics(leads, messages, visitorEvents, 7);

    expect(result.summary.funnel.visitor).toBe(4);
    expect(result.summary.funnel.lead).toBe(4);
    expect(result.summary.funnel.qualified).toBe(3);
    expect(result.summary.funnel.booked).toBe(1);
    expect(result.summary.conversion_rate).toBe(25);
    expect(result.summary.avg_response_time_seconds).toBe(140);
    expect(result.summary.avg_response_time_minutes).toBeCloseTo(2.33, 2);
    expect(result.summary.leads_per_day).toBeCloseTo(0.57, 2);

    const nonZeroLeadDays = result.daily.filter((row) => row.leads > 0);
    expect(nonZeroLeadDays.length).toBe(3);
  });
});
