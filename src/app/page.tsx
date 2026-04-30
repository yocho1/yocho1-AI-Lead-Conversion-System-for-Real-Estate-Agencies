import Link from "next/link";
import { ChatWidget } from "@/components/chat-widget";
import { HeroDashboardPreview } from "@/components/hero-dashboard-preview";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ agencyKey?: string; demo?: string; source?: string; campaign_id?: string; campaignId?: string }>;
}) {
  const params = await searchParams;
  const agencyApiKey = params.agencyKey || "demo-agency-key";
  const demoMode = params.demo === "true";
  const source = params.source;
  const campaignId = params.campaign_id || params.campaignId;

  return (
    <main className="container" style={{ paddingBlock: "2.5rem 4rem" }}>
      <section className="hero-shell surface-card surface-glass relative overflow-hidden p-5 md:p-8">
        <div className="hero-orb hero-orb-left" aria-hidden />
        <div className="hero-orb hero-orb-right" aria-hidden />

        <div className="hero-grid relative z-[1] grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="hero-copy animate-fade-up">
            <p className="m-0 inline-flex w-fit items-center rounded-full border border-[color:color-mix(in_srgb,var(--secondary)_35%,var(--border))] bg-[color:color-mix(in_srgb,var(--secondary)_15%,transparent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em] text-[var(--text)]">
              AI Lead Conversion System
            </p>

            <h1 className="m-0 mt-4 text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[var(--text)]">
              Turn Website Visitors Into Booked Property Visits - Automatically
            </h1>

            <p className="m-0 mt-4 max-w-[58ch] text-[1.03rem] leading-[1.6] text-[var(--text-soft)]">
              Qualify leads, detect serious buyers, and lock visits in real-time with AI so your agency closes more high-ticket deals without manual follow-up.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[var(--text-soft)]">
              <span className="hero-trust">Trusted by 50+ agencies</span>
              <span className="hero-dot" />
              <span className="hero-trust">Processing 1,000+ leads/month</span>
              <span className="hero-dot" />
              <span className="hero-trust">Built for high-ticket real estate</span>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={`/dashboard?agencyKey=${agencyApiKey}${demoMode ? "&demo=true" : ""}`}
                className="hero-cta-primary inline-flex items-center justify-center rounded-xl px-6 py-3 text-base font-extrabold text-white"
              >
                🔥 Start Converting Leads
              </Link>

              <Link
                href={`/dashboard?agencyKey=${agencyApiKey}${demoMode ? "&demo=true" : ""}`}
                className="hero-cta-secondary inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold"
              >
                View Demo
              </Link>
            </div>

            <p className="m-0 mt-3 text-xs text-[var(--text-soft)]">Agency key: {agencyApiKey}</p>
          </div>

          <div className="hero-visual animate-fade-up">
            <HeroDashboardPreview />
          </div>
        </div>
      </section>

      <ChatWidget agencyApiKey={agencyApiKey} demoMode={demoMode} source={source} campaignId={campaignId} />
    </main>
  );
}
