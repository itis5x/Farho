"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart, type CartItem } from "./cart";
import { cn } from "@/lib/utils";

export function AddToCart({
  product,
  cartHref,
  buttonClass,
}: {
  product: Omit<CartItem, "quantity">;
  cartHref: string;
  buttonClass: string;
}) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.stock === 0;
  const max = Math.min(product.stock ?? 99, 99);

  if (soldOut) {
    return (
      <button disabled className={cn("w-full cursor-not-allowed bg-zinc-200 py-3 font-semibold text-zinc-500", buttonClass)}>
        Sold out
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex items-center rounded-lg border border-zinc-300">
          <button type="button" className="px-3 py-2 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            −
          </button>
          <span className="w-10 text-center font-medium">{qty}</span>
          <button type="button" className="px-3 py-2 text-lg" onClick={() => setQty((q) => Math.min(max, q + 1))} aria-label="Increase quantity">
            +
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            add(product, qty);
            setAdded(true);
          }}
          className={cn("flex-1 bg-brand py-3 font-semibold text-white hover:opacity-90", buttonClass)}
        >
          Add to cart
        </button>
      </div>
      {added && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Added to your cart
          <Link href={cartHref} className="font-semibold underline">
            View cart & checkout
          </Link>
        </div>
      )}
    </div>
  );
}
