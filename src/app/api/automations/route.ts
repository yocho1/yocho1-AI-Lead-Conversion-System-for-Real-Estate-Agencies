import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

const createAutomationSchema = z.object({
  trigger: z.string().trim().min(1).max(120),
  condition: z.string().trim().max(4000).optional().nullable(),
  action: z.string().trim().min(1).max(4000),
});

function isMissingAutomationsTableError(errorMessage: string | undefined) {
  if (!errorMessage) return false;
  const normalized = errorMessage.toLowerCase();
  return normalized.includes("automations") && (normalized.includes("schema cache") || normalized.includes("does not exist"));
}

export async function GET(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const { data, error } = await supabase
    .from("automations")
    .select("id, trigger, condition, action, created_at")
    .eq("agency_id", agencyContext.agencyId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingAutomationsTableError(error.message)) {
      return NextResponse.json(
        {
          automations: [],
          configured: false,
          error: "Automation table is not initialized in Supabase. Please run the latest schema migration.",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: "Unable to load automations" }, { status: 500 });
  }

  return NextResponse.json({ automations: data || [], configured: true });
}

export async function POST(request: Request) {
  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = createAutomationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid automation payload" }, { status: 400 });
  }

  const { trigger, condition, action } = parsed.data;
  const { data, error } = await supabase
    .from("automations")
    .insert({
      agency_id: agencyContext.agencyId,
      trigger,
      condition: condition || null,
      action,
    })
    .select("id, trigger, condition, action, created_at")
    .single();

  if (error || !data) {
    if (error && isMissingAutomationsTableError(error.message)) {
      return NextResponse.json(
        {
          error: "Automation table is not initialized in Supabase. Please run the latest schema migration.",
          configured: false,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Unable to create automation" }, { status: 500 });
  }

  return NextResponse.json({ automation: data }, { status: 201 });
}
