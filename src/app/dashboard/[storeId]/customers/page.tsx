import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Customer } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { storeId } = await params;
  const { q = "" } = await searchParams;
  const { store } = await requireStore(storeId);
  const customers = db
    .prepare(
      `SELECT c.*,
         COUNT(o.id) AS order_count,
         COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total END), 0) AS spent,
         MAX(o.created_at) AS last_order
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
       WHERE c.store_id = ? AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)
       GROUP BY c.id ORDER BY last_order DESC`,
    )
    .all(store.id, `%${q}%`, `%${q}%`, `%${q}%`) as (Customer & { order_count: number; spent: number; last_order: string | null })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-sm text-zinc-600">Everyone who has ordered from {store.name}.</p>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name, phone or email" className="input max-w-sm" />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Total spent</th>
              <th className="px-4 py-3">Last order</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-500">
                  No customers yet. They&apos;ll appear here after their first order.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="relative hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/dashboard/${store.id}/customers/${c.id}`} className="after:absolute after:inset-0">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3">{c.city || "—"}</td>
                <td className="px-4 py-3">{c.order_count}</td>
                <td className="px-4 py-3 font-semibold">{formatMoney(c.spent, store.currency)}</td>
                <td className="px-4 py-3 text-zinc-600">{c.last_order ? formatDate(c.last_order) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
