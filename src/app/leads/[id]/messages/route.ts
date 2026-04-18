import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const incomingUrl = new URL(request.url);
  const url = new URL(`/api/leads/${id}/messages`, request.url);
  incomingUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  const proxyResponse = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const payload = await proxyResponse.json().catch(() => ({}));
  return NextResponse.json(payload, { status: proxyResponse.status });
}
