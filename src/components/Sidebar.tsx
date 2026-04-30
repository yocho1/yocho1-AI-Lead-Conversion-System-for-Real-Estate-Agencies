"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bot,
  CalendarCheck2,
  Handshake,
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
  Building2,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: Users },
      { label: "Deals", href: "/deals", icon: Handshake },
      { label: "Properties", href: "/properties", icon: Building2 },
      { label: "Bookings", href: "/bookings", icon: CalendarCheck2 },
    ],
  },
  {
    title: "Communication",
    items: [{ label: "Inbox", href: "/inbox", icon: Inbox }],
  },
  {
    title: "Growth",
    items: [{ label: "Campaigns", href: "/campaigns", icon: Megaphone }],
  },
  {
    title: "System",
    items: [
      { label: "Automation", href: "/automation", icon: Bot },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  mobileOpen,
  onNavigate,
}: Readonly<{
  mobileOpen: boolean;
  onNavigate: () => void;
}>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preservedQuery = useMemo(() => {
    const agencyKey = searchParams.get("agencyKey");
    const demo = searchParams.get("demo");
    const nextParams = new URLSearchParams();

    if (agencyKey) {
      nextParams.set("agencyKey", agencyKey);
    }

    if (demo) {
      nextParams.set("demo", demo);
    }

    const query = nextParams.toString();
    return query ? `?${query}` : "";
  }, [searchParams]);

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onNavigate}
        aria-hidden
      />

      <aside
        className={`saas-sidebar fixed inset-y-0 left-0 z-40 w-72 border-r border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_96%,transparent)] p-4 shadow-2xl backdrop-blur transition-transform md:static md:z-auto md:w-72 md:translate-x-0 md:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--secondary),var(--cta))] text-white shadow-lg">
            <Building2 size={20} />
          </div>
          <div>
            <p className="m-0 text-sm font-semibold tracking-tight">AI Lead Conversion</p>
            <p className="m-0 text-xs text-[var(--text-soft)]">SaaS Workspace</p>
          </div>
        </div>

        <nav className="space-y-5 overflow-y-auto pr-1">
          {NAV_GROUPS.map((group) => (
            <section key={group.title}>
              <p className="mb-2 px-2 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--text-soft)]">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={`${item.href}${preservedQuery}`}
                      onClick={onNavigate}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "border border-[color:color-mix(in_srgb,var(--secondary)_50%,var(--border))] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--secondary)_22%,transparent),color-mix(in_srgb,var(--secondary)_10%,transparent))] text-[var(--text)] shadow-[var(--shadow-card)]"
                          : "border border-transparent text-[var(--text-soft)] hover:border-[color:color-mix(in_srgb,var(--secondary)_35%,var(--border))] hover:bg-[color:color-mix(in_srgb,var(--secondary)_15%,transparent)] hover:text-[var(--text)]"
                      }`}
                    >
                      <Icon size={18} className={`transition-transform ${isActive ? "scale-105" : "group-hover:scale-105"}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>
    </>
  );
}
