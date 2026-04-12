import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ agencyKey?: string }>;
}) {
  const params = await searchParams;

  return (
    <DashboardShell>
      <h1 style={{ marginTop: "0.15rem" }}>Settings</h1>
      <div className="card" style={{ maxWidth: "680px" }}>
        <p style={{ marginTop: 0 }}>
          Embed your chat widget using this URL format and replace the agency key with your real agency API key.
        </p>
        <pre
          style={{
            background: "#0f172a",
            color: "#f8fafc",
            borderRadius: "10px",
            padding: "0.8rem",
            overflowX: "auto",
            fontSize: "0.86rem",
          }}
        >
{`<iframe
  src="${process.env.APP_URL || "http://localhost:3000"}/?agencyKey=${params.agencyKey || "YOUR_AGENCY_API_KEY"}"
  style="width:390px;height:540px;border:0;"
/>`}
        </pre>
      </div>
    </DashboardShell>
  );
}
