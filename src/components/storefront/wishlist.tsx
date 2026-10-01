"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn, formatMoney } from "@/lib/utils";

export type WishItem = { id: string; slug: string; name: string; price: number; image: string };

const key = (store: string) => `farho_wish_${store}`;
const read = (store: string): WishItem[] => {
  try {
    return JSON.parse(localStorage.getItem(key(store)) ?? "[]");
  } catch {
    return [];
  }
};
const write = (store: string, items: WishItem[]) => {
  try {
    localStorage.setItem(key(store), JSON.stringify(items.slice(0, 100)));
    window.dispatchEvent(new Event("farho-wishlist"));
  } catch {
    /* storage unavailable */
  }
};

function useWishlist(store: string) {
  const [items, setItems] = useState<WishItem[]>([]);
  useEffect(() => {
    const sync = () => setItems(read(store));
    sync();
    window.addEventListener("farho-wishlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("farho-wishlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, [store]);
  return items;
}

export function HeartButton({ store, item, className }: { store: string; item: WishItem; className?: string }) {
  const items = useWishlist(store);
  const saved = items.some((i) => i.id === item.id);
  return (
    <button
      type="button"
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={saved}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        write(store, saved ? items.filter((i) => i.id !== item.id) : [item, ...items]);
      }}
      className={cn("grid h-9 w-9 place-items-center rounded-full bg-white/90 text-lg shadow transition hover:scale-110", saved ? "text-rose-500" : "text-zinc-400", className)}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}

export function WishlistLink({ store, href }: { store: string; href: string }) {
  const count = useWishlist(store).length;
  return (
    <Link href={href} className="relative hover:opacity-70" aria-label="Wishlist">
      ♡
      {count > 0 && <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{count}</span>}
    </Link>
  );
}

export function WishlistPage({ store, base, currency }: { store: string; base: string; currency: string }) {
  const items = useWishlist(store);
  if (!items.length)
    return (
      <div className="py-20 text-center">
        <div className="text-5xl">♡</div>
        <p className="mt-3 text-zinc-600">Tap the heart on any product to save it here.</p>
        <Link href={`${base}/products`} className="mt-4 inline-block font-medium text-brand underline">Browse products</Link>
      </div>
    );
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((i) => (
        <Link key={i.id} href={`${base}/p/${i.slug}`} className="group relative overflow-hidden rounded-xl border border-zinc-200">
          <div className="aspect-square bg-zinc-100">
            {i.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.image} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <HeartButton store={store} item={i} className="absolute right-2 top-2" />
          <div className="p-3">
            <div className="text-sm font-medium">{i.name}</div>
            <div className="font-semibold text-brand">{formatMoney(i.price, currency)}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
