import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/form";
import { StatusBadge } from "@/components/status-badge";
import { addOrderNote, updateOrderStatus, updatePaymentStatus } from "@/lib/actions/orders";
import { requireStore } from "@/lib/auth";
import { getOrder, listOrderEvents, listOrderItems, listOrdersByCustomer } from "@/lib/data";
import { METHOD_LABELS, type PaymentMethod } from "@/lib/payments/settings";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/types";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Order" };

const FLOW = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;

export default async function OrderPage({ params }: { params: Promise<{ storeId: string; orderId: string }> }) {
  const { storeId, orderId } = await params;
  const { store } = await requireStore(storeId);
  const order = await getOrder(store.id, orderId);
  if (!order) notFound();
  const [items, events, customerOrders] = await Promise.all([
    listOrderItems([order.id]),
    listOrderEvents(order.id),
    order.customer_id ? listOrdersByCustomer(order.customer_id) : Promise.resolve([]),
  ]);
  const live = customerOrders.filter((o) => o.status !== "cancelled");
  const history = order.customer_id ? { n: live.length, spent: live.reduce((s, o) => s + o.total, 0) } : null;
  const money = (n: number) => formatMoney(n, store.currency);
  const stepIndex = FLOW.indexOf(order.status as (typeof FLOW)[number]);
  const nextStatus = stepIndex >= 0 && stepIndex < FLOW.length - 1 ? FLOW[stepIndex + 1] : null;

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/dashboard/${store.id}/orders`} className="text-sm text-zinc-500 hover:underline">
            ← Orders
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold">
            Order #{order.number} <StatusBadge status={order.status} /> <StatusBadge status={order.payment_status} />
          </h1>
          <p className="text-sm text-zinc-500">Placed {formatDate(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
          {nextStatus && (
            <form action={updateOrderStatus.bind(null, store.id, order.id)}>
              <input type="hidden" name="status" value={nextStatus} />
              <SubmitButton className="btn-primary capitalize" pendingText="Updating…">
                Mark as {nextStatus}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {order.status !== "cancelled" && (
        <ol className="no-print card flex overflow-x-auto p-4">
          {FLOW.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
                  i <= stepIndex ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500",
                )}
              >
                {i < stepIndex ? "✓" : i + 1}
              </span>
              <span className={cn("text-sm capitalize", i <= stepIndex ? "font-medium" : "text-zinc-500")}>{s}</span>
              {i < FLOW.length - 1 && <span className={cn("mx-2 h-0.5 min-w-4 flex-1", i < stepIndex ? "bg-indigo-600" : "bg-zinc-200")} />}
            </li>
          ))}
        </ol>
      )}

      {/* Print-only invoice header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">{store.name}</h1>
        <p className="text-sm">{[store.address, store.contact_phone, store.contact_email].filter(Boolean).join(" · ")}</p>
        <h2 className="mt-4 text-xl font-semibold">Invoice — Order #{order.number}</h2>
        <p className="text-sm">{formatDate(order.created_at)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">Items</h2>
            <ul className="divide-y divide-zinc-100">
              {items.map((it) => (
                <li key={it.id} className="flex items-center gap-4 px-5 py-3">
                  {it.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.image_url} alt="" className="h-12 w-12 rounded-md object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-md bg-zinc-100" />
                  )}
                  <div className="flex-1">
                    {it.product_id ? (
                      <Link href={`/dashboard/${store.id}/products/${it.product_id}`} className="font-medium hover:underline">
                        {it.name}
                      </Link>
                    ) : (
                      <span className="font-medium">{it.name}</span>
                    )}
                    <div className="text-sm text-zinc-500">
                      {money(it.price)} × {it.quantity}
                    </div>
                  </div>
                  <div className="font-semibold">{money(it.price * it.quantity)}</div>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-zinc-100 px-5 py-4 text-sm">
              <Row label="Subtotal" value={money(order.subtotal)} />
              {order.discount > 0 && <Row label={`Discount (${order.coupon_code})`} value={`− ${money(order.discount)}`} />}
              <Row label="Delivery" value={order.delivery_charge ? money(order.delivery_charge) : "Free"} />
              <div className="flex justify-between pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{money(order.total)}</dd>
              </div>
              <Row
                label="Payment method"
                value={`${METHOD_LABELS[order.payment_method as PaymentMethod] ?? order.payment_method}${order.payment_gateway_mode === "farho" ? " (Farho Pay)" : ""}`}
              />
              {order.payment_ref && <Row label="Payment reference" value={order.payment_ref} />}
              <Row label="Order came from" value={SOURCE_LABELS[order.source] ?? "Website"} />
              {order.paid_at && <Row label="Paid at" value={formatDate(order.paid_at)} />}
              {order.payment_proof_url && (
                <div className="pt-2">
                  <a href={order.payment_proof_url} target="_blank" className="text-sm text-indigo-600 hover:underline">
                    View customer&apos;s payment screenshot ↗
                  </a>
                </div>
              )}
            </dl>
          </div>

          <div className="no-print card">
            <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">Timeline</h2>
            <form action={addOrderNote.bind(null, store.id, order.id)} className="flex gap-2 border-b border-zinc-100 px-5 py-4">
              <input name="note" className="input" placeholder="Add an internal note (e.g. called customer, courier name)" required />
              <SubmitButton className="btn-secondary" pendingText="Adding…">
                Add note
              </SubmitButton>
            </form>
            <ol className="space-y-4 px-5 py-4">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      e.kind === "note" ? "bg-amber-500" : e.kind === "payment" ? "bg-emerald-500" : "bg-indigo-500",
                    )}
                  />
                  <div>
                    <p className={e.kind === "note" ? "rounded-lg bg-amber-50 px-3 py-2" : ""}>{e.message}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatDate(e.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="no-print card space-y-4 p-5">
            <h2 className="font-semibold">Manage order</h2>
            <form action={updateOrderStatus.bind(null, store.id, order.id)}>
              <label className="label" htmlFor="status">Order status</label>
              <div className="flex gap-2">
                <select key={order.status} id="status" name="status" defaultValue={order.status} className="input capitalize">
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn-secondary" pendingText="…">
                  Update
                </SubmitButton>
              </div>
            </form>
            <form action={updatePaymentStatus.bind(null, store.id, order.id)}>
              <label className="label" htmlFor="payment_status">Payment status</label>
              <div className="flex gap-2">
                <select key={order.payment_status} id="payment_status" name="payment_status" defaultValue={order.payment_status} className="input capitalize">
                  {PAYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <SubmitButton className="btn-secondary" pendingText="…">
                  Update
                </SubmitButton>
              </div>
            </form>
            {order.status !== "cancelled" && (
              <p className="text-xs text-zinc-500">Cancelling an order puts its items back in stock.</p>
            )}
          </div>

          <div className="card p-5 text-sm">
            <h2 className="font-semibold">Customer</h2>
            <p className="mt-2 font-medium">{order.customer_name}</p>
            <p>
              <a href={`tel:${order.phone}`} className="text-indigo-600 hover:underline">
                {order.phone}
              </a>
            </p>
            {order.email && <p className="text-zinc-600">{order.email}</p>}
            {history && order.customer_id && (
              <Link href={`/dashboard/${store.id}/customers/${order.customer_id}`} className="no-print mt-2 block text-xs text-indigo-600 hover:underline">
                {history.n} order{history.n === 1 ? "" : "s"} · {money(history.spent)} lifetime →
              </Link>
            )}
            <h3 className="mt-4 font-semibold">Delivery address</h3>
            <p className="mt-1 whitespace-pre-line text-zinc-700">
              {order.address}
              {order.city && `, ${order.city}`}
            </p>
            {order.note && (
              <>
                <h3 className="mt-4 font-semibold">Customer note</h3>
                <p className="mt-1 rounded-lg bg-zinc-50 p-2 text-zinc-700">{order.note}</p>
              </>
            )}
          </div>
          <div className="no-print card p-5 text-sm">
            <h2 className="font-semibold">Customer tracking link</h2>
            <p className="mt-1 text-xs text-zinc-500">Share this with the customer so they can follow their order.</p>
            <a
              href={`/store/${store.slug}/order/${order.public_token}`}
              target="_blank"
              className="mt-2 block truncate text-indigo-600 hover:underline"
            >
              /store/{store.slug}/order/{order.public_token.slice(0, 8)}…
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  chat: "Website chat",
  messenger: "Messenger",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  manual: "Added manually",
  pos: "In-store (POS)",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-zinc-600">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
