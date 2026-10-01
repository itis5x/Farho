"use client";

import Link from "next/link";
import { lineKey, useCart } from "./cart";
import { cn, formatMoney } from "@/lib/utils";

export function CartView({ storeSlug, currency, buttonClass }: { storeSlug: string; currency: string; buttonClass: string }) {
  const { items, ready, subtotal, setQty, remove } = useCart();
  const base = `/store/${storeSlug}`;
  if (!ready) return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-zinc-500">Loading cart…</div>;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="text-6xl">🛒</div>
        <h1 className="mt-4 text-2xl font-bold">Your cart is empty</h1>
        <Link href={`${base}/products`} className={cn("mt-6 inline-block bg-brand px-8 py-3 font-semibold text-white", buttonClass)}>
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Your cart</h1>
      <ul className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200">
        {items.map((it) => (
          <li key={lineKey(it)} className="flex gap-4 py-4">
            <Link href={`${base}/p/${it.slug}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
              {it.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.image} alt="" className="h-full w-full object-cover" />
              )}
            </Link>
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex justify-between gap-4">
                <Link href={`${base}/p/${it.slug}`} className="font-medium hover:underline">
                  {it.name}
                  {it.variantTitle && <span className="block text-sm font-normal text-zinc-500">{it.variantTitle}</span>}
                </Link>
                <span className="font-semibold">{formatMoney(it.price * it.quantity, currency)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center rounded-lg border border-zinc-300 text-sm">
                  <button className="px-3 py-1" onClick={() => setQty(lineKey(it), it.quantity - 1)} aria-label="Decrease">
                    −
                  </button>
                  <span className="w-8 text-center">{it.quantity}</span>
                  <button className="px-3 py-1" onClick={() => setQty(lineKey(it), it.quantity + 1)} aria-label="Increase">
                    +
                  </button>
                </div>
                <button className="text-sm text-zinc-500 hover:text-rose-600" onClick={() => remove(lineKey(it))}>
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col items-end gap-4">
        <div className="text-lg">
          Subtotal: <span className="font-bold">{formatMoney(subtotal, currency)}</span>
        </div>
        <p className="text-sm text-zinc-500">Delivery and discounts are calculated at checkout.</p>
        <div className="flex gap-3">
          <Link href={`${base}/products`} className={cn("border border-zinc-300 px-6 py-3 font-medium", buttonClass)}>
            Continue shopping
          </Link>
          <Link href={`${base}/checkout`} className={cn("bg-brand px-8 py-3 font-semibold text-white hover:opacity-90", buttonClass)}>
            Checkout →
          </Link>
        </div>
      </div>
    </div>
  );
}
