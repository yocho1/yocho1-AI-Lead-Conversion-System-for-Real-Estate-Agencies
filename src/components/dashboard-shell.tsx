"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, LayoutDashboard, Users } from "lucide-react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const agencyKey = params.get("agencyKey") || "demo-agency-key";

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    gap: "0.6rem",
    alignItems: "center",
    padding: "0.65rem 0.75rem",
    borderRadius: "10px",
    color: active ? "#0f766e" : "#31455f",
    background: active ? "#dbf5f1" : "transparent",
    fontWeight: active ? 700 : 500,
  });

  return (
    <div className="app-shell">
      <aside style={{ borderRight: "1px solid #d6deea", padding: "1rem", background: "#fbfcff" }}>
        <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.06rem" }}>
          <Building2 size={16} style={{ marginRight: "0.4rem", position: "relative", top: "2px" }} />
          Agency CRM
        </h2>

        <nav style={{ display: "grid", gap: "0.2rem" }}>
          <Link href={`/dashboard?agencyKey=${agencyKey}`} style={itemStyle(pathname === "/dashboard")}>
            <Users size={16} /> Leads
          </Link>
          <Link href={`/dashboard/settings?agencyKey=${agencyKey}`} style={itemStyle(pathname === "/dashboard/settings")}>
            <LayoutDashboard size={16} /> Settings
          </Link>
        </nav>
      </aside>

      <main style={{ padding: "1.1rem" }}>{children}</main>
    </div>
  );
}
