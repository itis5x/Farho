import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import { ORDER_STATUSES, type Order } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Orders" };

const PAGE_SIZE = 25;

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { store } = await requireStore(storeId);
  const status = (ORDER_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status! : "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const where = ["store_id = ?"];
  const args: (string | number)[] = [store.id];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }
  if (q) {
    where.push("(customer_name LIKE ? OR phone LIKE ? OR CAST(number AS TEXT) = ?)");
    args.push(`%${q}%`, `%${q}%`, q.replace(/^#/, ""));
  }
  const whereSql = where.join(" AND ");
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM orders WHERE ${whereSql}`).get(...args) as { total: number };
  const orders = db
    .prepare(
      `SELECT o.*, (SELECT SUM(quantity) FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o WHERE ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, PAGE_SIZE, (page - 1) * PAGE_SIZE) as (Order & { item_count: number })[];
  const counts = Object.fromEntries(
    (
      db.prepare("SELECT status, COUNT(*) AS n FROM orders WHERE store_id = ? GROUP BY status").all(store.id) as {
        status: string;
        n: number;
      }[]
    ).map((r) => [r.status, r.n]),
  );
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (overrides: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const merged = { status, q, page: 1, ...overrides };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/dashboard/${store.id}/orders${s ? `?${s}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-sm text-zinc-600">Manage and fulfil orders from your website.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-zinc-200">
        {[["", "All", allCount] as const, ...ORDER_STATUSES.map((s) => [s, s, counts[s] ?? 0] as const)].map(
          ([value, label, n]) => (
            <Link
              key={value}
              href={href({ status: value })}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium capitalize",
                status === value ? "border-indigo-600 text-indigo-700" : "border-transparent text-zinc-600 hover:text-zinc-900",
              )}
            >
              {label} <span className="ml-1 rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600">{n}</span>
            </Link>
          ),
        )}
      </div>

      <form className="flex gap-2">
        {status && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={q} placeholder="Search by order #, name or phone" className="input max-w-sm" />
        <button className="btn-secondary">Search</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  No orders found.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="relative hover:bg-zinc-50">
                <td className="px-4 py-3 font-semibold">
                  <Link href={`/dashboard/${store.id}/orders/${o.id}`} className="after:absolute after:inset-0">
                    #{o.number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3">
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-zinc-500">{o.phone}</div>
                </td>
                <td className="px-4 py-3">{o.item_count}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.payment_status} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(o.total, store.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-600">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href({ page: page - 1 })} className="btn-secondary">
                ← Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href({ page: page + 1 })} className="btn-secondary">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
