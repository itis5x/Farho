import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Customer, Order } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ storeId: string; customerId: string }> }) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const customer = db
    .prepare("SELECT * FROM customers WHERE id = ? AND store_id = ?")
    .get(Number(customerId), store.id) as Customer | undefined;
  if (!customer) notFound();
  const orders = db
    .prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC")
    .all(customer.id) as Order[];
  const spent = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/${store.id}/customers`} className="text-sm text-zinc-500 hover:underline">
          ← Customers
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{customer.name}</h1>
        <p className="text-sm text-zinc-500">Customer since {formatDate(customer.created_at)}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 text-sm">
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-2">
            <a href={`tel:${customer.phone}`} className="text-indigo-600 hover:underline">
              {customer.phone}
            </a>
          </p>
          {customer.email && <p>{customer.email}</p>}
          <h2 className="mt-4 font-semibold">Address</h2>
          <p className="mt-1 text-zinc-700">
            {customer.address}
            {customer.city && `, ${customer.city}`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Orders</div>
              <div className="text-lg font-bold">{orders.length}</div>
            </div>
            <div className="rounded-lg bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">Spent</div>
              <div className="text-lg font-bold">{formatMoney(spent, store.currency)}</div>
            </div>
          </div>
        </div>
        <div className="card lg:col-span-2">
          <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">Orders</h2>
          <ul className="divide-y divide-zinc-100">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/dashboard/${store.id}/orders/${o.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50"
                >
                  <div>
                    <div className="text-sm font-medium">#{o.number}</div>
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
        </div>
      </div>
    </div>
  );
}
