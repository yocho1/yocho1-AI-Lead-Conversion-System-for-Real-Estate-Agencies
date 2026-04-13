import Link from "next/link";
import { ChatWidget } from "@/components/chat-widget";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";

  return (
    <main className="container" style={{ paddingBlock: "4rem" }}>
      <section className="card" style={{ padding: "2rem", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            right: "-90px",
            top: "-100px",
            width: "240px",
            height: "240px",
            borderRadius: "999px",
            background: "radial-gradient(circle, #14b8a6 0%, rgba(20, 184, 166, 0) 70%)",
          }}
        />
        <p style={{ color: "#0f766e", fontWeight: 700, letterSpacing: ".02em" }}>AI Lead Conversion System</p>
        <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.1rem)", margin: "0.7rem 0" }}>
          Convert real estate visitors into booked property visits.
        </h1>
        <p style={{ color: "#4c617a", maxWidth: "62ch" }}>
          This MVP captures website leads, qualifies budget and urgency, stores every conversation in a CRM, and nudges hot leads
          toward appointment booking.
        </p>

        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
          <Link
            href={`/dashboard?agencyKey=${agencyApiKey}`}
            style={{
              background: "#0f766e",
              color: "#fff",
              borderRadius: "11px",
              padding: "0.65rem 1rem",
              fontWeight: 600,
            }}
          >
            Open CRM Dashboard
          </Link>
          <span style={{ color: "#4c617a", alignSelf: "center" }}>Agency key: {agencyApiKey}</span>
          {demoMode && (
            <span
              style={{
                color: "#065f46",
                background: "#d1fae5",
                border: "1px solid #86efac",
                borderRadius: "999px",
                padding: "0.3rem 0.7rem",
                fontWeight: 700,
                fontSize: "0.82rem",
              }}
            >
              Demo Mode
            </span>
          )}
        </div>
      </section>

      <ChatWidget agencyApiKey={agencyApiKey} demoMode={demoMode} />
    </main>
  );
}
