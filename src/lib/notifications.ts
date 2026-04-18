type HotLeadPayload = {
  name: string | null | undefined;
  budget: string | null | undefined;
  location: string | null | undefined;
  timeline: string | null | undefined;
};

export async function sendHotLeadAlertEmail(payload: HotLeadPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.HOT_LEAD_ALERT_TO;
  const from = process.env.HOT_LEAD_ALERT_FROM || "onboarding@resend.dev";

  if (!apiKey || !to) {
    return { sent: false, reason: "missing_alert_env" as const };
  }

  const text = [
    "🔥 HOT LEAD:",
    `Name: ${payload.name || "Unknown"}`,
    `Budget: ${payload.budget || "N/A"}`,
    `Location: ${payload.location || "N/A"}`,
    `Timeline: ${payload.timeline || "N/A"}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "🔥 HOT LEAD",
      text,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return { sent: false, reason: details as string };
  }

  return { sent: true as const };
}
