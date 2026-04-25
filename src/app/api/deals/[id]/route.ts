import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";
import { z } from "zod";

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW_LEAD: ["QUALIFIED", "LOST"],
  QUALIFIED: ["NEW_LEAD", "VISIT_SCHEDULED", "NEGOTIATION", "LOST"],
  VISIT_SCHEDULED: ["NEW_LEAD", "NEGOTIATION", "LOST"],
  NEGOTIATION: ["NEW_LEAD", "OFFER_MADE", "LOST"],
  OFFER_MADE: ["NEW_LEAD", "CLOSED", "NEGOTIATION", "LOST"],
  CLOSED: ["LOST"],
  LOST: ["NEW_LEAD"],
};

const TransitionStageSchema = z.object({
  stage: z.enum([
    "NEW_LEAD",
    "QUALIFIED",
    "VISIT_SCHEDULED",
    "NEGOTIATION",
    "OFFER_MADE",
    "CLOSED",
    "LOST",
  ]),
});

async function resolveDealId(params: { id?: string } | Promise<{ id?: string }>) {
  const resolved = await Promise.resolve(params);
  const id = resolved?.id;
  return typeof id === "string" ? id : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);

  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  try {
    const dealId = await resolveDealId(params);
    if (!dealId) {
      return NextResponse.json({ error: "Deal id is required" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = TransitionStageSchema.parse(body);

    // Get current deal
    const dealResult = await supabase
      .from("deals")
      .select("id, stage, agency_id")
      .eq("id", dealId)
      .single()
      ;

    if (dealResult.error || !dealResult.data) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    // Verify agency ownership
    if (dealResult.data.agency_id !== agencyContext.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const currentStage = dealResult.data.stage;
    const newStage = validatedData.stage;

    // Idempotent no-op: duplicate drop events can request the same target stage twice.
    if (currentStage === newStage) {
      return NextResponse.json({
        id: dealId,
        stage: currentStage,
        unchanged: true,
      });
    }

    // Validate transition
    if (!VALID_TRANSITIONS[currentStage]?.includes(newStage)) {
      const validStages = VALID_TRANSITIONS[currentStage] || [];
      return NextResponse.json(
        {
          error: `Invalid transition from ${currentStage} to ${newStage}`,
          validTransitions: validStages,
        },
        { status: 400 }
      );
    }

    // Update deal stage
    const updateResult = await supabase
      .from("deals")
      .update({
        stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .select()
      .single()
      ;

    if (updateResult.error) throw updateResult.error;

    // Log stage transition
    const eventData = {
      deal_id: dealId,
      from_stage: currentStage,
      to_stage: newStage,
      changed_at: new Date().toISOString(),
      changed_by: "user",
    };

    await supabase
      .from("deal_events")
      .insert(eventData)
      ;

    return NextResponse.json(updateResult.data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error updating deal stage:", error);
    return NextResponse.json(
      { error: "Failed to update deal stage" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);

  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  try {
    const dealId = await resolveDealId(params);
    if (!dealId) {
      return NextResponse.json({ error: "Deal id is required" }, { status: 400 });
    }

    // Verify deal exists and belongs to agency
    const dealResult = await supabase
      .from("deals")
      .select("id, agency_id")
      .eq("id", dealId)
      .single()
      ;

    if (dealResult.error || !dealResult.data) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      );
    }

    if (dealResult.data.agency_id !== agencyContext.agencyId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Delete deal (cascade will handle deal_events)
    const deleteResult = await supabase
      .from("deals")
      .delete()
      .eq("id", dealId)
      ;

    if (deleteResult.error) throw deleteResult.error;

    // Clear deal_id from leads
    await supabase
      .from("leads")
      .update({ deal_id: null })
      .eq("deal_id", dealId)
      ;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal:", error);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    );
  }
}

