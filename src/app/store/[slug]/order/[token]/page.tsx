import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByToken, listOrderItems } from "@/lib/data";
import { getStorefront } from "@/lib/store-data";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Your order", robots: { index: false } };

const STEPS = [
  { key: "pending", label: "Order placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Packing" },
  { key: "shipped", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug, token } = await params;
  const { new: isNew } = await searchParams;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const order = /^[a-f0-9]{32}$/.test(token) ? await getOrderByToken(store.id, token) : null;
  if (!order) notFound();
  const items = await listOrderItems([order.id]);
  const money = (n: number) => formatMoney(n, store.currency);
  const step = STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {isNew && (
        <div className="mb-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl">✓</div>
          <h1 className="mt-4 text-3xl font-bold">Thank you, {order.customer_name.split(" ")[0]}!</h1>
          <p className="mt-2 text-zinc-600">
            Your order has been placed. {store.name} will contact you on {order.phone} to confirm it.
          </p>
          <p className="mt-2 text-sm text-zinc-500">Bookmark this page to track your order.</p>
        </div>
      )}
      <div className="rounded-2xl border border-zinc-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">Order #{order.number}</h2>
          <span className="text-sm text-zinc-500">{formatDate(order.created_at)}</span>
        </div>
        {order.status === "cancelled" ? (
          <p className="mt-6 rounded-lg bg-rose-50 p-4 text-rose-700">This order was cancelled.</p>
        ) : (
          <ol className="mt-8 grid grid-cols-5 gap-2">
            {STEPS.map((s, i) => (
              <li key={s.key} className="text-center">
                <div className={cn("h-1.5 rounded-full", i <= step ? "bg-brand" : "bg-zinc-200")} />
                <span className={cn("mt-2 block text-xs sm:text-sm", i <= step ? "font-semibold" : "text-zinc-500")}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        )}
        <ul className="mt-8 divide-y divide-zinc-100">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-4 py-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-100">
                {it.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="flex-1 text-sm">
                <div className="font-medium">{it.name}</div>
                <div className="text-zinc-500">
                  {money(it.price)} × {it.quantity}
                </div>
              </div>
              <div className="font-medium">{money(it.price * it.quantity)}</div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-zinc-100 pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {order.discount > 0 && (
            <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(order.discount)}</dd></div>
          )}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{order.delivery_charge ? money(order.delivery_charge) : "Free"}</dd></div>
          <div className="flex justify-between pt-2 text-lg font-bold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
          <div className="flex justify-between text-zinc-500">
            <dt>Payment</dt>
            <dd>Cash on delivery · <span className="capitalize">{order.payment_status}</span></dd>
          </div>
        </dl>
        <div className="mt-6 rounded-lg bg-zinc-50 p-4 text-sm">
          <div className="font-semibold">Delivering to</div>
          <p className="mt-1 text-zinc-700">
            {order.customer_name} · {order.phone}
            <br />
            {order.address}, {order.city}
          </p>
        </div>
      </div>
      <div className="mt-8 text-center">
        <Link href={`/store/${store.slug}/products`} className="font-medium text-brand hover:underline">
          Continue shopping →
        </Link>
      </div>
    </div>
  );
}
