import { requireUser } from "@/lib/auth";

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="min-h-screen bg-zinc-50">{children}</div>;
}
