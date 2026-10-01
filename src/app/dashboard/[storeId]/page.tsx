import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireStore } from "@/lib/auth";
import { countProducts, listLowStock, listOrders } from "@/lib/data";
import { Query } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { countRows } from "@/lib/appwrite";
import { formatDate, formatMoney, storeUrl } from "@/lib/utils";

export const metadata = { title: "Overview" };

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { storeId } = await params;
  const { welcome } = await searchParams;
  const { store } = await requireStore(storeId);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [recentOrders, products, customers, lowStock, allPending] = await Promise.all([
    listOrders(store.id, [Query.greaterThanEqual("created_at", since)]),
    countProducts(store.id),
    countRows(TABLES.customers, [Query.equal("store_id", store.id)]),
    listLowStock(store.id),
    listOrders(store.id, [Query.equal("status", "pending"), Query.select(["$id"])]),
  ]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const live = recentOrders.filter((o) => o.status !== "cancelled");
  const stats = {
    orders: recentOrders.length,
    revenue: live.reduce((s, o) => s + o.total, 0),
    pending: allPending.length,
    today: recentOrders.filter((o) => o.created_at.slice(0, 10) === todayKey).length,
  };
  const counts = { products, customers };

  const byDay = new Map<string, number>();
  for (const o of live) byDay.set(o.created_at.slice(0, 10), (byDay.get(o.created_at.slice(0, 10)) ?? 0) + o.total);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (13 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: byDay.get(key) ?? 0 };
  });
  const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));

  const recent = recentOrders.length >= 6 ? recentOrders.slice(0, 6) : (await listOrders(store.id)).slice(0, 6);

  const checklist = [
    { done: counts.products > 0, label: "Add your first product", href: `/dashboard/${store.id}/products/new` },
    { done: !!store.logo_url || store.hero_title !== `Welcome to ${store.name}`, label: "Customise your website design", href: `/dashboard/${store.id}/design` },
    { done: !!store.contact_phone, label: "Add contact & delivery details", href: `/dashboard/${store.id}/settings` },
    { done: stats.orders > 0, label: "Get your first order", href: storeUrl(store.slug) },
  ];
  const showChecklist = welcome || checklist.some((c) => !c.done);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{welcome ? `🎉 ${store.name} is ready!` : "Overview"}</h1>
        <p className="text-sm text-zinc-600">Last 30 days performance for {store.name}.</p>
      </div>

      {showChecklist && (
        <div className="card p-5">
          <h2 className="font-semibold">Get your store ready</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                <Link
                  href={c.href}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-xs ${c.done ? "bg-emerald-500 text-white" : "border border-zinc-300"}`}
                  >
                    {c.done && "✓"}
                  </span>
                  <span className={c.done ? "text-zinc-400 line-through" : ""}>{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (30d)" value={formatMoney(stats.revenue, store.currency)} />
        <StatCard label="Orders (30d)" value={stats.orders} hint={`${stats.today} today`} />
        <StatCard label="Pending orders" value={stats.pending} href={`/dashboard/${store.id}/orders?status=pending`} />
        <StatCard label="Customers" value={counts.customers} hint={`${counts.products} products`} />
      </div>

      <div className="card p-5">
        <h2 className="font-semibold">Sales — last 14 days</h2>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {days.map((d) => (
            <div key={d.key} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-indigo-500 transition group-hover:bg-indigo-600"
                style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%` }}
              />
              <div className="pointer-events-none absolute -top-8 hidden whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white group-hover:block">
                {d.label}: {formatMoney(d.revenue, store.currency)}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-500">
          <span>{days[0].label}</span>
          <span>Today</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Link href={`/dashboard/${store.id}/orders`} className="text-sm text-indigo-600 hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">No orders yet. Share your store link to get your first sale!</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {recent.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/dashboard/${store.id}/orders/${o.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-zinc-50"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        #{o.number} · {o.customer_name}
                      </div>
                      <div className="text-xs text-zinc-500">{formatDate(o.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={o.status} />
                      <span className="text-sm font-semibold">{formatMoney(o.total, store.currency)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold">Low stock</h2>
          </div>
          {lowStock.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">All products are well stocked.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lowStock.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/${store.id}/products/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 text-sm hover:bg-zinc-50"
                  >
                    <span className="truncate">{p.name}</span>
                    <span className={p.stock === 0 ? "font-semibold text-rose-600" : "text-amber-600"}>
                      {p.stock === 0 ? "Sold out" : `${p.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-5 hover:border-indigo-300">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}
