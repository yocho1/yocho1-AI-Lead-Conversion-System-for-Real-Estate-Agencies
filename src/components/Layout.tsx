"use client";

import { Menu, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

function titleFromPath(pathname: string) {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/analytics": "Analytics",
    "/leads": "Leads",
    "/deals": "Deals",
    "/properties": "Properties",
    "/bookings": "Bookings",
    "/inbox": "Inbox",
    "/campaigns": "Campaigns",
    "/automation": "Automation",
    "/settings": "Settings",
  };

  return map[pathname] || "Workspace";
}

export function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageTitle = useMemo(() => titleFromPath(pathname), [pathname]);

  return (
    <div className="min-h-screen bg-transparent text-[var(--text)]">
      <div className="flex min-h-screen">
        <Sidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_88%,transparent)] px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileOpen((prev) => !prev)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-soft)] transition hover:text-[var(--text)] md:hidden"
                  aria-label="Toggle sidebar"
                >
                  <Menu size={18} />
                </button>

                <div>
                  <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-soft)]">Workspace</p>
                  <h1 className="m-0 text-lg font-semibold tracking-tight md:text-xl">{pageTitle}</h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-soft)] md:flex">
                  <Search size={15} />
                  <span>Search</span>
                </div>
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="min-w-0 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
