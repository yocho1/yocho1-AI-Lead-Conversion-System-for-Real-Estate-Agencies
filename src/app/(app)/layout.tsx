import { Layout } from "@/components/Layout";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Layout>{children}</Layout>;
}
