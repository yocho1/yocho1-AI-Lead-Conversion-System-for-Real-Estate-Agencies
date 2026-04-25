import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardSettingsRedirect({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ agencyKey?: string; demo?: string }>;
}>) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.agencyKey) {
    query.set("agencyKey", params.agencyKey);
  }

  if (params.demo) {
    query.set("demo", params.demo);
  }

  const suffix = query.toString();
  redirect(suffix ? `/settings?${suffix}` : "/settings");
}
