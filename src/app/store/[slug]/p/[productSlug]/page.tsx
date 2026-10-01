import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductCard } from "@/components/storefront/product-card";
import { db } from "@/lib/db";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

function loadProduct(storeId: number, slug: string) {
  return db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug FROM products p
       LEFT JOIN categories c ON c.id = p.category_id WHERE p.store_id = ? AND p.slug = ? AND p.active = 1`,
    )
    .get(storeId, slug) as (Product & { category_name: string | null; category_slug: string | null }) | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const { store } = await getStorefront(slug);
  const p = loadProduct(store.id, productSlug);
  if (!p) return {};
  return { title: p.name, description: p.description.slice(0, 160), openGraph: { images: p.image_url ? [p.image_url] : [] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const product = loadProduct(store.id, productSlug);
  if (!product) notFound();
  const t = THEME_STYLES[store.theme];
  const base = `/store/${store.slug}`;
  const related = db
    .prepare(
      "SELECT * FROM products WHERE store_id = ? AND active = 1 AND id != ? AND (category_id IS ? OR ? IS NULL) ORDER BY RANDOM() LIMIT 4",
    )
    .all(store.id, product.id, product.category_id, product.category_id) as Product[];
  const off =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-6 text-sm text-zinc-500">
        <Link href={base} className="hover:underline">Home</Link> /{" "}
        <Link href={`${base}/products`} className="hover:underline">Shop</Link>
        {product.category_slug && (
          <>
            {" "}/{" "}
            <Link href={`${base}/products?category=${product.category_slug}`} className="hover:underline">
              {product.category_name}
            </Link>
          </>
        )}
      </nav>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl bg-zinc-100">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <div className="grid aspect-square place-items-center text-7xl text-zinc-300">🛍️</div>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand">{formatMoney(product.price, store.currency)}</span>
            {off > 0 && (
              <>
                <span className="text-lg text-zinc-400 line-through">{formatMoney(product.compare_at_price!, store.currency)}</span>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-sm font-semibold text-rose-700">Save {off}%</span>
              </>
            )}
          </div>
          <p className="mt-2 text-sm">
            {product.stock === 0 ? (
              <span className="font-medium text-rose-600">Sold out</span>
            ) : product.stock != null && product.stock <= 5 ? (
              <span className="font-medium text-amber-600">Only {product.stock} left!</span>
            ) : (
              <span className="text-emerald-600">In stock</span>
            )}
          </p>
          <div className="mt-8">
            <AddToCart
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price,
                image: product.image_url,
                stock: product.stock,
              }}
              cartHref={`${base}/cart`}
              buttonClass={t.button}
            />
          </div>
          <ul className="mt-8 space-y-2 text-sm text-zinc-600">
            <li>💵 Cash on delivery available</li>
            {store.delivery_charge > 0 && (
              <li>
                🚚 Delivery {formatMoney(store.delivery_charge, store.currency)}
                {store.free_delivery_over > 0 && ` · Free over ${formatMoney(store.free_delivery_over, store.currency)}`}
              </li>
            )}
            {store.delivery_charge === 0 && <li>🚚 Free delivery</li>}
          </ul>
          {product.description && (
            <div className="mt-8 border-t border-zinc-200 pt-6">
              <h2 className="font-semibold">Description</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-700">{product.description}</p>
            </div>
          )}
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold">You may also like</h2>
          <div className={t.grid}>
            {related.map((p) => (
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
