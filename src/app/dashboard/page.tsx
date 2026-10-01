import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { countProducts, getStore, listOrders, listStoresByOwner, staffForUser } from "@/lib/data";
import { Query } from "@/lib/appwrite";
import type { Store } from "@/lib/types";
import { formatMoney, storeUrl } from "@/lib/utils";

export const metadata = { title: "Your stores" };

type StoreRow = Store & { order_count: number; pending_count: number; revenue: number; product_count: number; role: string };

export default async function StoresPage() {
  const user = await requireUser();
  const [owned, memberships] = await Promise.all([listStoresByOwner(user.id), staffForUser(user.id)]);
  const shared = (await Promise.all(memberships.map(async (m) => ({ store: await getStore(m.store_id), role: m.role })))).filter((x) => x.store);
  if (!owned.length && !shared.length) redirect("/dashboard/new");
  const all = [...owned.map((s) => ({ store: s, role: "owner" })), ...shared.map((x) => ({ store: x.store!, role: x.role }))];
  const stores: StoreRow[] = await Promise.all(
    all.map(async ({ store: s, role }) => {
      const [orders, product_count] = await Promise.all([
        listOrders(s.id, [Query.select(["$id", "status", "total", "created_at"])]),
        countProducts(s.id),
      ]);
      return {
        ...s,
        order_count: orders.length,
        pending_count: orders.filter((o) => o.status === "pending").length,
        revenue: orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0),
        product_count,
        role,
      };
    }),
  );

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Your stores</h1>
            <p className="text-sm text-zinc-600">Pick a store to open its admin panel.</p>
          </div>
          <Link href="/dashboard/new" className="btn-primary">
            + Create store
          </Link>
        </div>

        {stores.length === 0 ? (
          <div className="card mt-8 p-12 text-center">
            <div className="text-5xl">🛍️</div>
            <h2 className="mt-4 text-lg font-semibold">You don&apos;t have a store yet</h2>
            <p className="mt-1 text-sm text-zinc-600">Create your first store and start selling today.</p>
            <Link href="/dashboard/new" className="btn-primary mt-6">
              Create your first store
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <div key={s.id} className="card overflow-hidden">
                <div className="h-2" style={{ background: s.primary_color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {s.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span
                          className="grid h-10 w-10 place-items-center rounded-lg font-bold text-white"
                          style={{ background: s.primary_color }}
                        >
                          {s.name[0]?.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <h2 className="font-semibold">{s.name}</h2>
                        <p className="text-xs text-zinc-500">/store/{s.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {s.role !== "owner" && <span className="badge bg-indigo-50 text-indigo-700">{s.role}</span>}
                      {!s.published && <span className="badge bg-zinc-100 text-zinc-600">Draft</span>}
                    </div>
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
                    <Stat label="Orders" value={s.order_count} />
                    <Stat label="Pending" value={s.pending_count} />
                    <Stat label="Products" value={s.product_count} />
                  </dl>
                  <p className="mt-4 text-sm text-zinc-600">
                    Revenue: <span className="font-semibold text-zinc-900">{formatMoney(s.revenue, s.currency)}</span>
                  </p>
                  <div className="mt-5 flex gap-2">
                    <Link href={`/dashboard/${s.id}`} className="btn-primary flex-1">
                      Open admin
                    </Link>
                    <a href={storeUrl(s.slug)} target="_blank" className="btn-secondary">
                      Visit ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 py-2">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
