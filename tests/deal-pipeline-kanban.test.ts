import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { DealPipelineKanban } from "@/components/deal-pipeline-kanban";

const pipelinePayload = {
  NEW_LEAD: [
    {
      id: "deal-1",
      lead_id: "lead-1",
      stage: "NEW_LEAD",
      deal_value: 450000,
      commission_rate: null,
      assigned_agent_id: null,
      created_at: "2026-04-20T10:00:00.000Z",
      updated_at: "2026-04-20T10:00:00.000Z",
      leads: {
        id: "lead-1",
        name: "John Carter",
        email: "john@example.com",
        phone: "+123456",
        budget: "450000",
        budget_value: 450000,
        location: "Miami",
        location_city: "Miami",
        property_type: "Apartment",
      },
    },
  ],
  QUALIFIED: [],
  VISIT_SCHEDULED: [],
  NEGOTIATION: [],
  OFFER_MADE: [],
  CLOSED: [],
  LOST: [],
};

const summaryPayload = {
  total_deals: 1,
  total_pipeline_value: 450000,
  closed_revenue: 0,
  conversion_rate: 0,
  by_stage: {
    NEW_LEAD: 1,
    QUALIFIED: 0,
    VISIT_SCHEDULED: 0,
    NEGOTIATION: 0,
    OFFER_MADE: 0,
    CLOSED: 0,
    LOST: 0,
  },
};

describe("DealPipelineKanban", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads pipeline and updates stage on drag and drop", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pipelinePayload })
      .mockResolvedValueOnce({ ok: true, json: async () => summaryPayload })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "deal-1", stage: "QUALIFIED" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...summaryPayload, by_stage: { ...summaryPayload.by_stage, NEW_LEAD: 0, QUALIFIED: 1 } }) });

    vi.stubGlobal("fetch", fetchMock);

    render(React.createElement(DealPipelineKanban, { agencyApiKey: "demo-agency-key" }));

    await waitFor(() => {
      expect(screen.getByText("John Carter")).toBeInTheDocument();
    });

    const card = screen.getByText("John Carter").closest("div[draggable='true']");
    expect(card).toBeTruthy();

    const qualifiedColumnTitle = screen.getByRole("heading", { name: "Qualified" });
    const qualifiedColumn = qualifiedColumnTitle.closest("div")?.parentElement;
    expect(qualifiedColumn).toBeTruthy();

    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "move",
      setData: vi.fn(),
      getData: vi.fn(),
      clearData: vi.fn(),
      setDragImage: vi.fn(),
      files: [],
      items: [],
      types: [],
    } as unknown as DataTransfer;

    fireEvent.dragStart(card as Element, { dataTransfer });
    fireEvent.dragOver(qualifiedColumn as Element, { dataTransfer });
    fireEvent.drop(qualifiedColumn as Element, { dataTransfer });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/deals/deal-1?agencyApiKey=demo-agency-key",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    await waitFor(() => {
      const qualifiedSection = screen.getByRole("heading", { name: "Qualified" }).closest("div")?.parentElement;
      expect(qualifiedSection?.textContent).toContain("John Carter");
    });
  });
});
