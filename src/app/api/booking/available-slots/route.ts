import { NextResponse } from "next/server";

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = (searchParams.get("agentId") || "").trim();
  const date = (searchParams.get("date") || "").trim();

  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must use YYYY-MM-DD" }, { status: 400 });
  }

  const url = new URL(`${getBackendBaseUrl()}/available-slots`);
  url.searchParams.set("agent_id", agentId);
  url.searchParams.set("date", date);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || "Unable to fetch available slots" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      agent_id: data?.agent_id || agentId,
      date: data?.date || date,
      slots: Array.isArray(data?.slots) ? data.slots : [],
      configured: typeof data?.configured === "boolean" ? data.configured : true,
      message: typeof data?.message === "string" ? data.message : null,
    });
  } catch {
    return NextResponse.json({ error: "Backend booking service unavailable" }, { status: 502 });
  }
}
