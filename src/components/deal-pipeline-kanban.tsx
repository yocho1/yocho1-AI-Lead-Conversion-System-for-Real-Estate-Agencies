"use client";

import React, { useEffect, useState, useCallback } from "react";

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function parseJsonSafely<T = unknown>(response: Response): Promise<T | { error: string }> {
  const text = await response.text();
  if (!text) return { error: "Empty response" };

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

interface Deal {
  id: string;
  lead_id: string;
  stage: string;
  deal_value: number | null;
  commission_rate: number | null;
  assigned_agent_id: string | null;
  created_at: string;
  updated_at: string;
  leads: {
    id: string;
    name: string;
    email: string;
    phone: string;
    budget: string;
    budget_value: number | null;
    location: string;
    location_city: string;
    property_type: string;
  } | null;
}

interface Pipeline {
  [key: string]: Deal[];
}

interface Summary {
  total_deals: number;
  total_pipeline_value: number;
  closed_revenue: number;
  lost_deals: number;
  active_deals: number;
  conversion_rate: number;
  by_stage: Record<string, number>;
}

const STAGES = [
  "NEW_LEAD",
  "QUALIFIED",
  "VISIT_SCHEDULED",
  "NEGOTIATION",
  "OFFER_MADE",
  "CLOSED",
  "LOST",
];

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  QUALIFIED: "Qualified",
  VISIT_SCHEDULED: "Visit Scheduled",
  NEGOTIATION: "Negotiation",
  OFFER_MADE: "Offer Made",
  CLOSED: "Closed ✓",
  LOST: "Lost ✗",
};

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-blue-50 border-blue-200",
  QUALIFIED: "bg-purple-50 border-purple-200",
  VISIT_SCHEDULED: "bg-yellow-50 border-yellow-200",
  NEGOTIATION: "bg-orange-50 border-orange-200",
  OFFER_MADE: "bg-pink-50 border-pink-200",
  CLOSED: "bg-green-50 border-green-200",
  LOST: "bg-red-50 border-red-200",
};

const CARD_COLORS: Record<string, string> = {
  NEW_LEAD: "border-l-4 border-l-blue-400 hover:shadow-md",
  QUALIFIED: "border-l-4 border-l-purple-400 hover:shadow-md",
  VISIT_SCHEDULED: "border-l-4 border-l-yellow-400 hover:shadow-md",
  NEGOTIATION: "border-l-4 border-l-orange-400 hover:shadow-md",
  OFFER_MADE: "border-l-4 border-l-pink-400 hover:shadow-md",
  CLOSED: "border-l-4 border-l-green-400 bg-green-50",
  LOST: "border-l-4 border-l-red-400 bg-red-50",
};

const CARD_BADGE_COLORS: Record<string, string> = {
  NEW_LEAD: "bg-blue-100 text-blue-800",
  QUALIFIED: "bg-purple-100 text-purple-800",
  VISIT_SCHEDULED: "bg-yellow-100 text-yellow-800",
  NEGOTIATION: "bg-orange-100 text-orange-800",
  OFFER_MADE: "bg-pink-100 text-pink-800",
  CLOSED: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
};

export function DealPipelineKanban({
  agencyApiKey,
}: {
  agencyApiKey: string;
}) {
  const [pipeline, setPipeline] = useState<Pipeline>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [draggedFromStage, setDraggedFromStage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const loadPipeline = useCallback(async () => {
    try {
      setLoading(true);
      setStatusMessage("");

      // Load pipeline
      const pipelineRes = await fetch(`/api/deals/pipeline?agencyApiKey=${agencyApiKey}`);
      const pipelineData = await parseJsonSafely(pipelineRes);
      if (!pipelineRes.ok) {
        throw new Error((pipelineData as { error?: string }).error || "Failed to load pipeline");
      }

      if ((pipelineData as { configured?: boolean }).configured === false) {
        setPipeline(((pipelineData as { pipeline?: Pipeline }).pipeline || {}));
        setSummary({
          total_deals: 0,
          total_pipeline_value: 0,
          closed_revenue: 0,
          lost_deals: 0,
          active_deals: 0,
          conversion_rate: 0,
          by_stage: {
            NEW_LEAD: 0,
            QUALIFIED: 0,
            VISIT_SCHEDULED: 0,
            NEGOTIATION: 0,
            OFFER_MADE: 0,
            CLOSED: 0,
            LOST: 0,
          },
        });
        setStatusMessage(
          (pipelineData as { error?: string }).error
          || "Deals pipeline is not initialized. Run the latest Supabase schema migration."
        );
        return;
      }

      setPipeline((pipelineData as { pipeline?: Pipeline }).pipeline || {});

      // Load summary
      const summaryRes = await fetch(`/api/deals/summary?agencyApiKey=${agencyApiKey}`);
      const summaryData = await parseJsonSafely(summaryRes);
      if (!summaryRes.ok) {
        throw new Error((summaryData as { error?: string }).error || "Failed to load summary");
      }
      setSummary(summaryData as Summary);
    } catch (error) {
      console.error("Error loading pipeline:", error);
      setStatusMessage(error instanceof Error ? error.message : "Failed to load deal pipeline");
    } finally {
      setLoading(false);
    }
  }, [agencyApiKey]);

  useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    deal: Deal,
    stage: string
  ) => {
    setDraggedDeal(deal);
    setDraggedFromStage(stage);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    newStage: string
  ) => {
    e.preventDefault();

    if (!draggedDeal || !draggedFromStage) return;

    // Don't allow dropping in the same stage
    if (draggedFromStage === newStage) {
      setDraggedDeal(null);
      setDraggedFromStage(null);
      return;
    }

    try {
      const response = await fetch(`/api/deals/${draggedDeal.id}?agencyApiKey=${agencyApiKey}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: newStage }),
      });

      const payload = await parseJsonSafely(response);

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error || "Failed to update deal stage");
      }

      // Update local state
      const oldStage = draggedFromStage;
      setPipeline((prev) => {
        const updated = { ...prev };
        updated[oldStage] = updated[oldStage].filter(
          (d) => d.id !== draggedDeal.id
        );
        updated[newStage] = [
          ...updated[newStage],
          { ...draggedDeal, stage: newStage },
        ];
        return updated;
      });

      setStatusMessage(`Deal moved to ${STAGE_LABELS[newStage]}`);

      // Reload summary
      const summaryRes = await fetch(`/api/deals/summary?agencyApiKey=${agencyApiKey}`);
      if (summaryRes.ok) {
        const summaryData = await parseJsonSafely<Summary>(summaryRes);
        if (!("error" in summaryData)) {
          setSummary(summaryData);
        }
      }
    } catch (error) {
      console.error("Error updating deal stage:", error);
      setStatusMessage(error instanceof Error ? error.message : "Failed to update deal");
    } finally {
      setDraggedDeal(null);
      setDraggedFromStage(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
      </div>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 shadow-sm md:p-6">
      {statusMessage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {statusMessage}
        </div>
      )}

      {/* Header */}
      <div className="mb-5 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Deal Pipeline
        </h1>
        <p className="text-sm text-slate-500">
          Move deals between stages to track progress and revenue.
        </p>

        {/* Summary Metrics */}
        {summary && (
          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Total Deals</p>
              <p className="text-2xl font-bold text-slate-900">
                {summary.total_deals}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Pipeline Value</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(summary.total_pipeline_value)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Closed Revenue</p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.closed_revenue)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-fuchsia-600">
                {summary.conversion_rate}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex max-w-full gap-4 overflow-x-auto pb-2">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className={`flex min-h-[18rem] min-w-[17.5rem] flex-shrink-0 flex-col rounded-xl border-2 bg-white p-4 ${STAGE_COLORS[stage]}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage)}
          >
            {/* Column Header */}
            <div className="mb-4">
              <h2 className="font-semibold text-gray-900 mb-1">
                {STAGE_LABELS[stage]}
              </h2>
              <p className="text-sm text-gray-500">
                {(pipeline[stage] || []).length} deal
                {(pipeline[stage] || []).length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Cards Container */}
            <div className="flex-1 space-y-3">
              {(pipeline[stage] || []).map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  stage={stage}
                  onDragStart={(e) => handleDragStart(e, deal, stage)}
                />
              ))}
              {(pipeline[stage] || []).length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Empty</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DealCard({
  deal,
  stage,
  onDragStart,
}: {
  deal: Deal;
  stage: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  const lead = deal.leads;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`bg-white p-3 rounded-md cursor-move transition-shadow ${CARD_COLORS[stage]}`}
    >
      {/* Lead Name */}
      <h3 className="font-semibold text-gray-900 text-sm mb-2 truncate">
        {lead?.name || "Unknown"}
      </h3>

      {/* Lead Details */}
      <div className="space-y-1 text-xs text-gray-600 mb-3">
        {lead?.email && (
          <p className="truncate">
            <span className="font-medium">Email:</span> {lead.email}
          </p>
        )}
        {lead?.phone && (
          <p>
            <span className="font-medium">Phone:</span> {lead.phone}
          </p>
        )}
        {lead?.location_city && (
          <p>
            <span className="font-medium">Location:</span> {lead.location_city}
          </p>
        )}
        {lead?.property_type && (
          <p>
            <span className="font-medium">Type:</span> {lead.property_type}
          </p>
        )}
      </div>

      {/* Deal Value */}
      {deal.deal_value && (
        <div className="mb-3 p-2 bg-gray-50 rounded-sm">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Deal Value:</span>{" "}
            {formatCurrency(deal.deal_value)}
          </p>
        </div>
      )}

      {/* Commission Rate */}
      {deal.commission_rate && (
        <p className="text-xs text-gray-600 mb-2">
          <span className="font-medium">Commission:</span> {deal.commission_rate}%
        </p>
      )}

      {/* Stage Badge */}
      <div className="flex justify-between items-center">
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-medium ${CARD_BADGE_COLORS[stage]}`}
        >
          {STAGE_LABELS[stage]}
        </span>
        <span className="text-xs text-gray-400">
          {new Date(deal.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
