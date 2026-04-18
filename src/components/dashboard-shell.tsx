"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Building2, LayoutDashboard, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const params = useSearchParams();
  const agencyKey = params.get("agencyKey") || "demo-agency-key";

  const itemClass = (active: boolean) =>
    [
      "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all duration-200",
      active
        ? "border-transparent text-white shadow-[var(--shadow-card)] bg-[linear-gradient(120deg,#2563eb,#1d4ed8)]"
        : "border-transparent text-[var(--text-soft)] hover:text-[var(--text)] hover:border-[color:color-mix(in_srgb,var(--secondary)_45%,var(--border))] hover:bg-[color:color-mix(in_srgb,#3b82f6_18%,transparent)]",
    ].join(" ");

  return (
    <div className="app-shell">
      <aside className="border-r border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors duration-200">
        <h2 className="m-0 mb-1 flex items-center gap-2 text-[1.04rem] font-semibold tracking-[-0.01em] text-[var(--text)]">
          <Building2 size={16} color="var(--secondary)" /> AI Lead Conversion
        </h2>
        <p className="m-0 mb-4 text-[0.82rem] text-[var(--text-soft)]">Enterprise CRM + AI Ops</p>

        <div className="mb-3">
          <ThemeToggle />
        </div>

        <nav className="grid gap-1">
          <Link href={`/dashboard?agencyKey=${agencyKey}`} className={itemClass(pathname === "/dashboard")}>
            <Users size={16} /> Leads
          </Link>
          <Link href={`/dashboard/settings?agencyKey=${agencyKey}`} className={itemClass(pathname === "/dashboard/settings")}>
            <LayoutDashboard size={16} /> Settings
          </Link>
        </nav>
      </aside>

      <main className="p-4 lg:p-[1.1rem]">{children}</main>
    </div>
  );
}
