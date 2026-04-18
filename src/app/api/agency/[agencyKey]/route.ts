import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

function isValidHexColor(input: string | null | undefined) {
  if (!input) return false;
  return /^#[0-9a-fA-F]{6}$/.test(input);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agencyKey: string }> },
) {
  const { agencyKey } = await params;

  if (!agencyKey || agencyKey.length < 4) {
    return NextResponse.json({ error: "Invalid agency key" }, { status: 400 });
  }

  if (agencyKey === "demo-agency-key") {
    return NextResponse.json({
      name: "Demo Realty",
      primaryColor: "#1e3a8a",
      logo: null,
      demoMode: true,
    });
  }

  const supabase = getServerSupabase();
  const { data: agency } = await supabase
    .from("agencies")
    .select("name, primary_color, logo_url")
    .eq("api_key", agencyKey)
    .maybeSingle();

  if (!agency) {
    return NextResponse.json({ error: "Agency not found" }, { status: 404 });
  }

  return NextResponse.json({
    name: agency.name,
    primaryColor: isValidHexColor(agency.primary_color) ? agency.primary_color : "#1e3a8a",
    logo: agency.logo_url || null,
    demoMode: false,
  });
}
