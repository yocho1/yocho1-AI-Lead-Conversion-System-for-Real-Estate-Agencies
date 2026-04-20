import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  leadId: z.string().min(3),
  agentId: z.string().min(2),
  datetime: z.string().min(10),
  status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
});

function getBackendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking payload" }, { status: 400 });
  }

  const payload = parsed.data;

  try {
    const response = await fetch(`${getBackendBaseUrl()}/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        lead_id: payload.leadId,
        agent_id: payload.agentId,
        datetime: payload.datetime,
        status: payload.status || "confirmed",
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail || data?.error || "Unable to create booking" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      booking: data?.booking || null,
      delivery: data?.delivery || null,
    });
  } catch {
    return NextResponse.json({ error: "Backend booking service unavailable" }, { status: 502 });
  }
}
