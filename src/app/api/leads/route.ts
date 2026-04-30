import { NextResponse } from "next/server";
import { requireAgencyContext } from "@/lib/agency-context";
import { getServerSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const demoMode = searchParams.get("demo") === "true";

  const supabase = getServerSupabase();
  const agencyContext = await requireAgencyContext(request, supabase);
  if (agencyContext instanceof NextResponse) {
    return agencyContext;
  }

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, source, campaign_id, name, email, phone, budget, budget_value, currency, location, location_city, location_country, property_type, buying_timeline, timeline_normalized, appointment_status, status, hot_alert_sent, chat_locked, last_message_at, created_at")
    .eq("agency_id", agencyContext.agencyId)
    .order("last_message_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load leads" }, { status: 500 });
  }

  if (!demoMode) {
    return NextResponse.json({ leads: leads || [] });
  }

  const demoLeads = [
    {
      id: "demo-hot-lead",
      source: "facebook",
      campaign_id: "demo-campaign-2026-q2",
      name: "Nadia Salem",
      email: "nadia.demo@lead.ai",
      phone: "+971500000111",
      budget: "650000",
      budget_value: 650000,
      currency: "USD",
      location: "Dubai Marina",
      location_city: "Dubai Marina",
      location_country: "United Arab Emirates",
      property_type: "apartment",
      buying_timeline: "asap",
      timeline_normalized: "asap",
      appointment_status: "reserved",
      status: "hot",
      hot_alert_sent: true,
      chat_locked: true,
      created_at: new Date().toISOString(),
    },
  ];

  return NextResponse.json({ leads: [...demoLeads, ...(leads || [])] });
}
