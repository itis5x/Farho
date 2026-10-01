import Link from "next/link";
import { THEME_STYLES } from "@/lib/storefront";
import type { Product, Store } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";
import { HeartButton } from "./wishlist";

export function ProductCard({ product, store }: { product: Product; store: Store }) {
  const t = THEME_STYLES[store.theme];
  const soldOut = product.stock === 0;
  const off =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;
  return (
    <Link href={`/store/${store.slug}/p/${product.slug}`} className={t.card}>
      <div className={cn("relative overflow-hidden bg-zinc-100", t.image)}>
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl text-zinc-300">🛍️</div>
        )}
        <HeartButton
          store={store.slug}
          item={{ id: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image_url }}
          className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 max-md:opacity-100"
        />
        {soldOut ? (
          <span className="absolute left-2 top-2 rounded bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">Sold out</span>
        ) : off > 0 ? (
          <span className="absolute left-2 top-2 rounded bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">-{off}%</span>
        ) : null}
      </div>
      <div className={store.theme === "minimal" ? "pt-3 text-center" : "p-3"}>
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        <div className={cn("mt-1 flex items-baseline gap-2", store.theme === "minimal" && "justify-center")}>
          <span className="font-semibold text-brand">{formatMoney(product.price, store.currency)}</span>
          {off > 0 && (
            <span className="text-xs text-zinc-400 line-through">{formatMoney(product.compare_at_price!, store.currency)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
