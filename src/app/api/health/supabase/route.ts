import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getServerSupabase();

    const { error: agenciesError } = await supabase.from("agencies").select("id").limit(1);
    if (agenciesError) {
      return NextResponse.json(
        {
          ok: false,
          message: "Supabase connected but agencies query failed",
          details: agenciesError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase connection is healthy",
      checks: {
        database: "connected",
        agenciesTable: "reachable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Supabase health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
