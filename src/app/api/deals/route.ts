import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";
import { z } from "zod";

// Validation schemas
const CreateDealSchema = z.object({
  lead_id: z.string().uuid("Invalid lead ID"),
  deal_value: z.number().positive("Deal value must be positive").optional(),
  commission_rate: z.number().min(0).max(100, "Commission rate must be 0-100").optional(),
  assigned_agent_id: z.string().uuid("Invalid agent ID").optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pipeline = searchParams.get("pipeline") === "true";
  const summary = searchParams.get("summary") === "true";

  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);

  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  try {
    if (summary) {
      // Get pipeline summary
      const result = await supabase
        .from("deals")
        .select("id, stage, deal_value")
        .eq("agency_id", agencyContext.agencyId)
        .execute();

      if (result.error) throw result.error;

      const deals = result.data || [];
      const totalDeals = deals.length;

      // Calculate metrics
      let totalPipelineValue = 0;
      let closedRevenue = 0;
      let lostDeals = 0;
      const stageCounts: Record<string, number> = {
        NEW_LEAD: 0,
        QUALIFIED: 0,
        VISIT_SCHEDULED: 0,
        NEGOTIATION: 0,
        OFFER_MADE: 0,
        CLOSED: 0,
        LOST: 0,
      };

      for (const deal of deals) {
        const stage = deal.stage;
        const dealValue = deal.deal_value || 0;

        stageCounts[stage] = (stageCounts[stage] || 0) + 1;

        if (stage !== "CLOSED" && stage !== "LOST") {
          totalPipelineValue += dealValue;
        }

        if (stage === "CLOSED") {
          closedRevenue += dealValue;
        }

        if (stage === "LOST") {
          lostDeals += 1;
        }
      }

      const conversionRate =
        totalDeals > 0 ? ((totalDeals - lostDeals) / totalDeals) * 100 : 0;

      return NextResponse.json({
        total_deals: totalDeals,
        total_pipeline_value: totalPipelineValue,
        closed_revenue: closedRevenue,
        lost_deals: lostDeals,
        active_deals: totalDeals - lostDeals,
        conversion_rate: Math.round(conversionRate * 100) / 100,
        by_stage: stageCounts,
      });
    }

    if (pipeline) {
      // Get pipeline grouped by stage
      const result = await supabase
        .from("deals")
        .select(
          `
          id,
          lead_id,
          stage,
          deal_value,
          commission_rate,
          assigned_agent_id,
          created_at,
          updated_at,
          leads!inner(id, name, email, phone, budget, budget_value, location, location_city, property_type)
          `
        )
        .eq("agency_id", agencyContext.agencyId)
        .order("updated_at", { ascending: false })
        .execute();

      if (result.error) throw result.error;

      // Group by stage
      const grouped: Record<string, unknown[]> = {
        NEW_LEAD: [],
        QUALIFIED: [],
        VISIT_SCHEDULED: [],
        NEGOTIATION: [],
        OFFER_MADE: [],
        CLOSED: [],
        LOST: [],
      };

      for (const deal of result.data || []) {
        const stage = deal.stage || "NEW_LEAD";
        if (grouped[stage]) {
          grouped[stage].push(deal);
        }
      }

      return NextResponse.json(grouped);
    }

    // Get all deals for agency
    const result = await supabase
      .from("deals")
      .select(
        `
        id,
        lead_id,
        stage,
        deal_value,
        commission_rate,
        assigned_agent_id,
        created_at,
        updated_at,
        leads(id, name, email, phone, budget, location)
        `
      )
      .eq("agency_id", agencyContext.agencyId)
      .order("updated_at", { ascending: false })
      .execute();

    if (result.error) throw result.error;

    return NextResponse.json({ deals: result.data || [] });
  } catch (error) {
    console.error("Error fetching deals:", error);
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);

  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  try {
    const body = await request.json();

    // Validate input
    const validatedData = CreateDealSchema.parse(body);

    // Verify lead exists and belongs to agency
    const leadResult = await supabase
      .from("leads")
      .select("id, agency_id, name, budget_value")
      .eq("id", validatedData.lead_id)
      .eq("agency_id", agencyContext.agencyId)
      .single()
      .execute();

    if (leadResult.error || !leadResult.data) {
      return NextResponse.json(
        { error: "Lead not found or not accessible" },
        { status: 404 }
      );
    }

    // Check if deal already exists
    const existingDeal = await supabase
      .from("deals")
      .select("id")
      .eq("lead_id", validatedData.lead_id)
      .single()
      .execute();

    if (existingDeal.data) {
      return NextResponse.json(
        { error: "Deal already exists for this lead" },
        { status: 409 }
      );
    }

    // Create deal
    const dealData = {
      agency_id: agencyContext.agencyId,
      lead_id: validatedData.lead_id,
      stage: "NEW_LEAD",
      deal_value: validatedData.deal_value || leadResult.data.budget_value,
      commission_rate: validatedData.commission_rate,
      assigned_agent_id: validatedData.assigned_agent_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const insertResult = await supabase
      .from("deals")
      .insert(dealData)
      .select()
      .single()
      .execute();

    if (insertResult.error) throw insertResult.error;

    // Update lead with deal_id
    await supabase
      .from("leads")
      .update({ deal_id: insertResult.data.id })
      .eq("id", validatedData.lead_id)
      .execute();

    return NextResponse.json(insertResult.data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating deal:", error);
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    );
  }
}
