import Link from "next/link";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { requireStore } from "@/lib/auth";
import { countOrders } from "@/lib/data";
import { listConversations } from "@/lib/inbox/data";
import { Query } from "@/lib/appwrite";
import { storeUrl } from "@/lib/utils";

export default async function StoreAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const { user, store, role } = await requireStore(storeId);
  const [pending, conversations] = await Promise.all([
    countOrders(store.id, [Query.equal("status", "pending")]),
    listConversations(store.id),
  ]);
  const unread = conversations.reduce((s, c) => s + (c.unread > 0 ? 1 : 0), 0);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="no-print border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <div className="lg:mt-6">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
              title="Switch store"
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-xs font-bold text-white"
                style={{ background: store.primary_color }}
              >
                {store.name[0]?.toUpperCase()}
              </span>
              <span className="truncate font-medium">{store.name}</span>
              <span className="ml-auto text-zinc-400">⇅</span>
            </Link>
          </div>
        </div>
        <AdminNav storeId={store.id} pending={pending} unread={unread} role={role} />
        <div className="hidden px-5 py-4 lg:block">
          <a href={storeUrl(store.slug)} target="_blank" className="btn-secondary w-full">
            View website ↗
          </a>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="no-print flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
          <div className="text-sm text-zinc-500">
            {store.published ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Live at{" "}
                <a href={storeUrl(store.slug)} target="_blank" className="font-medium text-zinc-800 hover:underline">
                  /store/{store.slug}
                </a>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-400" /> Store is unpublished
              </span>
            )}
          </div>
          <UserMenu user={user} />
        </header>
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </div>
    </div>
  );
}
