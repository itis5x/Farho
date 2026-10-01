"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart, type CartItem } from "./cart";
import type { ProductOption } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

export type BuyVariant = { id: string; title: string; option1: string; option2: string; option3: string; price: number | null; stock: number | null; image_url: string };

export function AddToCart({
  product,
  cartHref,
  buttonClass,
  options = [],
  variants = [],
  currency,
  whatsapp,
}: {
  product: Omit<CartItem, "quantity" | "variantId" | "variantTitle">;
  cartHref: string;
  buttonClass: string;
  options?: ProductOption[];
  variants?: BuyVariant[];
  currency: string;
  whatsapp?: string;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [picked, setPicked] = useState<string[]>(options.map(() => ""));

  const hasVariants = options.length > 0;
  const variant = useMemo(
    () => (hasVariants && picked.every(Boolean) ? variants.find((v) => [v.option1, v.option2, v.option3].slice(0, options.length).every((o, i) => o === picked[i])) : undefined),
    [hasVariants, picked, variants, options.length],
  );
  /** A value is unavailable if no in-stock variant matches it together with the other picks. */
  const available = (optIndex: number, value: string) =>
    variants.some((v) => {
      const vals = [v.option1, v.option2, v.option3];
      return vals[optIndex] === value && picked.every((p, i) => i === optIndex || !p || vals[i] === p) && v.stock !== 0;
    });

  const price = variant?.price ?? product.price;
  const stock = hasVariants ? (variant ? variant.stock : null) : product.stock;
  const soldOut = hasVariants ? variants.every((v) => v.stock === 0) : product.stock === 0;
  const max = Math.min(stock ?? 99, 99);
  const ready = !hasVariants || !!variant;

  const waText = encodeURIComponent(`Hi! I'd like to order: ${product.name}${variant ? ` (${variant.title})` : ""} × ${qty}`);

  return (
    <div className="space-y-4">
      {hasVariants && (
        <>
          <div className="text-2xl font-bold text-brand">{formatMoney(price, currency)}</div>
          {options.map((o, oi) => (
            <div key={o.name}>
              <div className="mb-2 text-sm font-medium">
                {o.name}: <span className="text-zinc-500">{picked[oi] || "choose"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {o.values.map((val) => {
                  const ok = available(oi, val);
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={!ok}
                      onClick={() => setPicked(picked.map((p, i) => (i === oi ? (p === val ? "" : val) : p)))}
                      className={cn(
                        "min-w-12 rounded-lg border-2 px-3 py-1.5 text-sm transition",
                        picked[oi] === val ? "border-brand bg-brand text-white" : "border-zinc-300 hover:border-zinc-500",
                        !ok && "cursor-not-allowed text-zinc-300 line-through hover:border-zinc-300",
                      )}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {variant && variant.stock != null && variant.stock <= 5 && variant.stock > 0 && (
            <p className="text-sm font-medium text-amber-600">Only {variant.stock} left in this option!</p>
          )}
        </>
      )}

      {soldOut ? (
        <button disabled className={cn("w-full cursor-not-allowed bg-zinc-200 py-3 font-semibold text-zinc-500", buttonClass)}>
          Sold out
        </button>
      ) : (
        <div className="flex gap-3">
          <div className="flex items-center rounded-lg border border-zinc-300">
            <button type="button" className="px-3 py-2 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
            <span className="w-10 text-center font-medium">{qty}</span>
            <button type="button" className="px-3 py-2 text-lg" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase quantity">+</button>
          </div>
          <button
            type="button"
            disabled={!ready || stock === 0}
            onClick={() => {
              add({ ...product, price, stock, image: variant?.image_url || product.image, variantId: variant?.id, variantTitle: variant?.title }, qty);
              setAdded(true);
            }}
            className={cn("flex-1 bg-brand py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50", buttonClass)}
          >
            {!ready ? `Choose ${options.find((_, i) => !picked[i])?.name.toLowerCase()}` : stock === 0 ? "Sold out" : "Add to cart"}
          </button>
        </div>
      )}
      {whatsapp && !soldOut && (
        <a
          href={`https://wa.me/${whatsapp}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("flex w-full items-center justify-center gap-2 border-2 border-[#25d366] py-2.5 font-semibold text-[#128c4a] hover:bg-[#25d366]/10", buttonClass)}
        >
          Order on WhatsApp
        </a>
      )}
      {added && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Added to your cart
          <Link href={cartHref} className="font-semibold underline">View cart & checkout</Link>
        </div>
      )}
    </div>
  );
}
