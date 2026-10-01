"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { createManualOrder } from "@/lib/actions/pos";
import type { PaymentMethod } from "@/lib/payments/settings";
import { cn, formatMoney } from "@/lib/utils";

export type PosProduct = {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  variantTitle: string;
  price: number;
  stock: number | null;
  image: string;
  codes: string[];
};

type Line = PosProduct & { qty: number };
type Done = { number: number; total: number; orderId: string; lines: Line[]; discount: number; delivery: number; method: string; tendered: number; at: string };

export function PosScreen({
  storeId,
  store,
  items,
  initialMode,
  qrImage,
}: {
  storeId: string;
  store: { name: string; address: string; phone: string; currency: string; delivery: number };
  items: PosProduct[];
  initialMode: "pos" | "delivery";
  qrImage: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState(store.delivery);
  const [method, setMethod] = useState<PaymentMethod>("cod");
  const [paid, setPaid] = useState(true);
  const [tendered, setTendered] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "", address: "", city: "", email: "" });
  const [source, setSource] = useState<"manual" | "messenger" | "instagram" | "whatsapp" | "telegram">("manual");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [saving, start] = useTransition();
  const search = useRef<HTMLInputElement>(null);
  const money = (n: number) => formatMoney(n, store.currency);
  const pos = mode === "pos";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items.filter((i) => `${i.name} ${i.variantTitle} ${i.codes.join(" ")}`.toLowerCase().includes(q)).slice(0, 12);
  }, [items, query]);

  const add = (p: PosProduct) => {
    setError("");
    setLines((ls) => {
      const found = ls.find((l) => l.key === p.key);
      const inCart = found?.qty ?? 0;
      if (p.stock != null && inCart + 1 > p.stock) {
        setError(`Only ${p.stock} of ${p.name}${p.variantTitle ? ` (${p.variantTitle})` : ""} in stock.`);
        return ls;
      }
      return found ? ls.map((l) => (l.key === p.key ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { ...p, qty: 1 }];
    });
  };

  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const deliveryFee = pos ? 0 : delivery;
  const total = Math.max(0, subtotal - discount) + deliveryFee;
  const change = Number(tendered) - total;

  const submit = () =>
    start(async () => {
      setError("");
      const res = await createManualOrder(storeId, {
        mode,
        items: lines.map((l) => ({ productId: l.productId, ...(l.variantId ? { variantId: l.variantId } : {}), quantity: l.qty })),
        customer,
        payment_method: pos && method === "cod" ? "cod" : method,
        paid: pos ? true : paid,
        discount,
        delivery: pos ? 0 : delivery,
        note,
        source: pos ? "manual" : source,
      });
      if (res.error || !res.orderId) {
        setError(res.error ?? "Couldn't save the order.");
        return;
      }
      setDone({ number: res.number!, total: res.total!, orderId: res.orderId, lines, discount, delivery: deliveryFee, method, tendered: Number(tendered) || 0, at: new Date().toLocaleString() });
      setLines([]);
      setDiscount(0);
      setTendered("");
      setCustomer({ name: "", phone: "", address: "", city: "", email: "" });
      setNote("");
    });

  const METHODS: [PaymentMethod, string][] = pos
    ? [["cod", "💵 Cash"], ["qr", "📱 QR / wallet"], ["bank", "💳 Card / bank"]]
    : [["cod", "Cash on delivery"], ["qr", "QR"], ["bank", "Bank transfer"], ["esewa", "eSewa"], ["khalti", "Khalti"]];

  return (
    <>
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{pos ? "Point of sale" : "New delivery order"}</h1>
            <p className="text-sm text-zinc-600">{pos ? "Scan a barcode or search to ring up a counter sale." : "Add an order you received by phone, Messenger, Instagram or WhatsApp."}</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-white p-1 text-sm shadow-xs ring-1 ring-zinc-200">
            {(["pos", "delivery"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setMethod("cod"); setPaid(m === "pos"); }} className={cn("rounded-md px-3 py-1.5 font-medium", mode === m ? "bg-indigo-600 text-white" : "text-zinc-600")}>
                {m === "pos" ? "🧾 Counter sale" : "🚚 Delivery order"}
              </button>
            ))}
          </div>
        </div>

        {done && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
            <span>
              ✓ Order #{done.number} saved · {money(done.total)}
              {pos && done.tendered > done.total && <> · Change: <strong>{money(done.tendered - done.total)}</strong></>}
            </span>
            <span className="flex gap-2">
              <button type="button" onClick={() => window.print()} className="btn-secondary">🖨️ Print receipt</button>
              <Link href={`/dashboard/${storeId}/orders/${done.orderId}`} className="btn-secondary">Open order</Link>
              <button type="button" onClick={() => { setDone(null); search.current?.focus(); }} className="btn-primary">New sale</button>
            </span>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          <div className="space-y-4">
            <input
              ref={search}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Barcode scanners type the code and press Enter.
                if (e.key !== "Enter") return;
                e.preventDefault();
                const q = query.trim().toLowerCase();
                const exact = items.find((i) => i.codes.some((c) => c.toLowerCase() === q));
                const hit = exact ?? (results.length === 1 ? results[0] : undefined);
                if (hit) {
                  add(hit);
                  setQuery("");
                } else setError(`No product matches “${query}”.`);
              }}
              placeholder="🔍 Scan barcode or search products…"
              className="input py-3 text-base"
              aria-label="Search products"
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {results.map((p) => (
                <button key={p.key} type="button" onClick={() => add(p)} disabled={p.stock === 0} className="card overflow-hidden text-left transition hover:border-indigo-400 disabled:opacity-40">
                  <div className="aspect-[4/3] bg-zinc-100">
                    {p.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="p-2 text-sm">
                    <div className="line-clamp-1 font-medium">{p.name}</div>
                    {p.variantTitle && <div className="text-xs text-zinc-500">{p.variantTitle}</div>}
                    <div className="flex justify-between">
                      <span className="font-semibold text-indigo-700">{money(p.price)}</span>
                      <span className="text-xs text-zinc-400">{p.stock == null ? "" : p.stock === 0 ? "sold out" : `${p.stock} left`}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card flex flex-col p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <h2 className="font-semibold">Order</h2>
            {lines.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Tap products or scan barcodes to add them.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-100">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-center gap-2 py-2 text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{l.name}</div>
                      {l.variantTitle && <div className="text-xs text-zinc-500">{l.variantTitle}</div>}
                      <div className="text-xs text-zinc-500">{money(l.price)}</div>
                    </div>
                    <div className="flex items-center rounded-md border border-zinc-300">
                      <button type="button" className="px-2" onClick={() => setLines((ls) => ls.flatMap((x) => (x.key === l.key ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))} aria-label="Less">−</button>
                      <span className="w-7 text-center">{l.qty}</span>
                      <button type="button" className="px-2" onClick={() => add(l)} aria-label="More">+</button>
                    </div>
                    <span className="w-20 text-right font-medium">{money(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
            )}

            {!pos && (
              <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="input" placeholder="Customer name" />
                  <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="input" placeholder="Phone" />
                  <input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} className="input col-span-2" placeholder="Delivery address" />
                  <input value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} className="input" placeholder="City" />
                  <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="input" aria-label="Where the order came from">
                    <option value="manual">Phone / other</option>
                    <option value="messenger">Messenger</option>
                    <option value="instagram">Instagram</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>
                <input value={note} onChange={(e) => setNote(e.target.value)} className="input" placeholder="Note (size, colour, delivery time…)" />
              </div>
            )}

            <dl className="mt-3 space-y-1 border-t border-zinc-100 pt-3 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex items-center justify-between">
                <dt>Discount</dt>
                <dd><input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} className="input w-24 py-1 text-right" placeholder="0" aria-label="Discount" /></dd>
              </div>
              {!pos && (
                <div className="flex items-center justify-between">
                  <dt>Delivery</dt>
                  <dd><input type="number" min={0} value={delivery} onChange={(e) => setDelivery(Math.max(0, Number(e.target.value)))} className="input w-24 py-1 text-right" aria-label="Delivery charge" /></dd>
                </div>
              )}
              <div className="flex justify-between pt-1 text-lg font-bold"><dt>Total</dt><dd>{money(total)}</dd></div>
            </dl>

            <div className="mt-3 flex flex-wrap gap-1">
              {METHODS.map(([m, label]) => (
                <button key={m} type="button" onClick={() => setMethod(m)} className={cn("rounded-md border px-2 py-1 text-xs font-medium", method === m ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-zinc-300")}>
                  {label}
                </button>
              ))}
            </div>
            {pos && method === "qr" && qrImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrImage} alt="Payment QR" className="mx-auto mt-3 h-40 w-40 rounded-lg object-contain" />
            )}
            {pos && method === "cod" && (
              <div className="mt-3 flex items-center justify-between text-sm">
                <label htmlFor="tendered">Cash received</label>
                <input id="tendered" type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} className="input w-28 py-1 text-right" />
              </div>
            )}
            {pos && method === "cod" && Number(tendered) > 0 && (
              <p className={cn("mt-1 text-right text-sm font-semibold", change >= 0 ? "text-emerald-700" : "text-rose-600")}>
                {change >= 0 ? `Change: ${money(change)}` : `Short by ${money(-change)}`}
              </p>
            )}
            {!pos && (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Customer has already paid
              </label>
            )}

            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button
              type="button"
              disabled={saving || !lines.length || (pos && method === "cod" && Number(tendered) > 0 && change < 0)}
              onClick={submit}
              className="btn-primary mt-4 w-full py-3 text-base"
            >
              {saving ? "Saving…" : pos ? `Charge ${money(total)}` : `Create order · ${money(total)}`}
            </button>
          </div>
        </div>
      </div>

      {done && (
        <div className="hidden font-mono text-[12px] leading-snug text-black print:block" style={{ width: "72mm" }}>
          <div className="text-center">
            <div className="text-base font-bold">{store.name}</div>
            {store.address && <div>{store.address}</div>}
            {store.phone && <div>Tel: {store.phone}</div>}
            <div className="my-1">--------------------------------</div>
            <div>Receipt #{done.number}</div>
            <div>{done.at}</div>
            <div className="my-1">--------------------------------</div>
          </div>
          {done.lines.map((l) => (
            <div key={l.key}>
              <div>{l.name}{l.variantTitle ? ` (${l.variantTitle})` : ""}</div>
              <div className="flex justify-between"><span>{l.qty} × {l.price}</span><span>{l.qty * l.price}</span></div>
            </div>
          ))}
          <div className="my-1">--------------------------------</div>
          {done.discount > 0 && <div className="flex justify-between"><span>Discount</span><span>-{done.discount}</span></div>}
          {done.delivery > 0 && <div className="flex justify-between"><span>Delivery</span><span>{done.delivery}</span></div>}
          <div className="flex justify-between font-bold"><span>TOTAL</span><span>{money(done.total)}</span></div>
          {done.tendered > 0 && (
            <>
              <div className="flex justify-between"><span>Cash</span><span>{done.tendered}</span></div>
              <div className="flex justify-between"><span>Change</span><span>{done.tendered - done.total}</span></div>
            </>
          )}
          <div className="my-1">--------------------------------</div>
          <div className="text-center">Thank you! Powered by Farho</div>
        </div>
      )}
    </>
  );
}
