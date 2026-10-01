import Link from "next/link";
import { Query } from "@/lib/appwrite";
import { requireStore } from "@/lib/auth";
import { listOrderItems, listOrders } from "@/lib/data";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/payments/settings";
import { cn, formatMoney } from "@/lib/utils";

export const metadata = { title: "Reports" };

const PERIODS = { "7": "7 days", "30": "30 days", "90": "90 days", "365": "12 months" } as const;
const SOURCE: Record<string, string> = {
  website: "🌐 Website",
  chat: "💬 Website chat",
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  manual: "📞 Added manually",
  pos: "🧾 Counter (POS)",
};

function Bars({ rows, money }: { rows: { label: string; value: number; extra?: string }[]; money: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-zinc-500">No sales in this period.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-medium">
              {money(r.value)}
              {r.extra && <span className="ml-1 text-xs font-normal text-zinc-500">{r.extra}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-zinc-100">
            <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ days?: string }> }) {
  const { storeId } = await params;
  const days = (Object.keys(PERIODS).includes((await searchParams).days ?? "") ? (await searchParams).days : "30") as keyof typeof PERIODS;
  const { store } = await requireStore(storeId);
  const money = (n: number) => formatMoney(Math.round(n), store.currency);
  const since = new Date(Date.now() - Number(days) * 86_400_000).toISOString();

  const orders = (await listOrders(store.id, [Query.greaterThanEqual("created_at", since)])).filter((o) => o.status !== "cancelled");
  const items = await listOrderItems(orders.map((o) => o.id));
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const goods = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const costed = items.filter((i) => i.cost_price != null);
  const cogs = costed.reduce((s, i) => s + (i.cost_price ?? 0) * i.quantity, 0);
  const costedSales = costed.reduce((s, i) => s + i.price * i.quantity, 0);
  const profit = costedSales - cogs;
  const margin = costedSales ? (profit / costedSales) * 100 : null;
  const discounts = orders.reduce((s, o) => s + o.discount, 0);
  const paidShare = orders.length ? (orders.filter((o) => o.payment_status === "paid").length / orders.length) * 100 : 0;

  const group = <K extends string>(keyOf: (o: (typeof orders)[number]) => K) => {
    const m = new Map<K, { value: number; count: number }>();
    for (const o of orders) {
      const k = keyOf(o);
      const cur = m.get(k) ?? { value: 0, count: 0 };
      m.set(k, { value: cur.value + o.total, count: cur.count + 1 });
    }
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  };

  const products = new Map<string, { label: string; qty: number; value: number; profit: number | null }>();
  for (const i of items) {
    const key = `${i.product_id}:${i.variant_title}`;
    const cur = products.get(key) ?? { label: `${i.name}${i.variant_title ? ` (${i.variant_title})` : ""}`, qty: 0, value: 0, profit: 0 };
    cur.qty += i.quantity;
    cur.value += i.price * i.quantity;
    cur.profit = i.cost_price == null || cur.profit == null ? null : cur.profit + (i.price - i.cost_price) * i.quantity;
    products.set(key, cur);
  }
  const top = [...products.values()].sort((a, b) => b.value - a.value).slice(0, 10);

  const stats: [string, string, string?][] = [
    ["Revenue", money(revenue), `${orders.length} orders`],
    ["Average order", money(orders.length ? revenue / orders.length : 0)],
    ["Gross profit", costed.length ? money(profit) : "—", margin != null ? `${margin.toFixed(0)}% margin on items with a cost price` : "Add cost prices to products to see profit"],
    ["Discounts given", money(discounts), `${paidShare.toFixed(0)}% of orders paid`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-zinc-600">How your store is doing (cancelled orders excluded).</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm shadow-xs ring-1 ring-zinc-200">
          {Object.entries(PERIODS).map(([d, label]) => (
            <Link key={d} href={`?days=${d}`} className={cn("rounded-md px-3 py-1.5 font-medium", d === days ? "bg-indigo-600 text-white" : "text-zinc-600")}>
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="card p-5">
            <div className="text-sm text-zinc-500">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
            {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Sales by channel</h2>
          <Bars money={money} rows={group((o) => o.source || "website").map(([k, v]) => ({ label: SOURCE[k] ?? k, value: v.value, extra: `· ${v.count}` }))} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Payment methods</h2>
          <Bars money={money} rows={group((o) => o.payment_method).map(([k, v]) => ({ label: METHOD_LABELS[k as PaymentMethod] ?? k, value: v.value, extra: `· ${v.count}` }))} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Top cities</h2>
          <Bars money={money} rows={group((o) => (o.city || "Unknown").trim().replace(/^./, (c) => c.toUpperCase())).slice(0, 8).map(([k, v]) => ({ label: k, value: v.value, extra: `· ${v.count}` }))} />
        </div>
      </div>
      <div className="card overflow-x-auto">
        <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">Best-selling products</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-5 py-2">Product</th>
              <th className="px-5 py-2 text-right">Sold</th>
              <th className="px-5 py-2 text-right">Sales</th>
              <th className="px-5 py-2 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {top.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-6 text-center text-zinc-500">No sales in this period.</td></tr>
            )}
            {top.map((p) => (
              <tr key={p.label}>
                <td className="px-5 py-2">{p.label}</td>
                <td className="px-5 py-2 text-right">{p.qty}</td>
                <td className="px-5 py-2 text-right font-medium">{money(p.value)}</td>
                <td className="px-5 py-2 text-right text-emerald-700">{p.profit == null ? "—" : money(p.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-5 py-3 text-xs text-zinc-500">Items revenue {money(goods)} · delivery and discounts not included in product sales.</p>
      </div>
    </div>
  );
}
