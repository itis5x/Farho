import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductCard } from "@/components/storefront/product-card";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ReviewForm, Stars } from "@/components/storefront/reviews";
import { HeartButton } from "@/components/storefront/wishlist";
import { getActiveProductBySlug, getCategory, listProductReviews, listProducts, listVariants, productImages, productOptions } from "@/lib/data";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import type { Product } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/utils";

async function loadProduct(storeId: string, slug: string) {
  const p = await getActiveProductBySlug(storeId, slug);
  if (!p) return null;
  const c = p.category_id ? await getCategory(storeId, p.category_id) : null;
  return { ...p, category_name: c?.name ?? null, category_slug: c?.slug ?? null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const { store } = await getStorefront(slug);
  const p = await loadProduct(store.id, productSlug);
  if (!p) return {};
  return { title: p.name, description: p.description.slice(0, 160), openGraph: { images: p.image_url ? [p.image_url] : [] } };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const product = await loadProduct(store.id, productSlug);
  if (!product) notFound();
  const t = THEME_STYLES[store.theme];
  const base = `/store/${store.slug}`;
  const related: Product[] = (await listProducts(store.id, { activeOnly: true }))
    .filter((p) => p.id !== product.id && (!product.category_id || p.category_id === product.category_id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
  const off =
    product.compare_at_price && product.compare_at_price > product.price
      ? Math.round((1 - product.price / product.compare_at_price) * 100)
      : 0;
  const reviews = await listProductReviews(product.id);
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const options = productOptions(product);
  const variants = options.length ? await listVariants(product.id) : [];
  const prices = variants.map((v) => v.price ?? product.price);
  const minPrice = prices.length ? Math.min(...prices) : product.price;
  const maxPrice = prices.length ? Math.max(...prices) : product.price;
  const whatsapp = store.contact_phone.replace(/\D/g, "").replace(/^(9\d{9})$/, "977$1");

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
        <ProductGallery images={productImages(product)} name={product.name} />
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-3xl font-bold">{product.name}</h1>
            <HeartButton store={store.slug} item={{ id: product.id, slug: product.slug, name: product.name, price: product.price, image: product.image_url }} className="shrink-0 border border-zinc-200" />
          </div>
          {reviews.length > 0 && (
            <a href="#reviews" className="mt-2 flex items-center gap-2 text-sm text-zinc-600">
              <Stars value={avg} /> {avg.toFixed(1)} · {reviews.length} review{reviews.length > 1 ? "s" : ""}
            </a>
          )}
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand">
              {minPrice !== maxPrice ? `${formatMoney(minPrice, store.currency)} – ${formatMoney(maxPrice, store.currency)}` : formatMoney(minPrice, store.currency)}
            </span>
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
              options={options}
              variants={variants.map(({ id, title, option1, option2, option3, price, stock, image_url }) => ({ id, title, option1, option2, option3, price, stock, image_url }))}
              currency={store.currency}
              whatsapp={whatsapp.length >= 10 ? whatsapp : undefined}
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
      <section id="reviews" className="mt-16 max-w-3xl">
        <h2 className="text-2xl font-bold">Customer reviews</h2>
        {reviews.length > 0 ? (
          <div className="mt-2 flex items-center gap-2 text-zinc-600">
            <Stars value={avg} className="text-xl" /> <span className="font-semibold text-zinc-900">{avg.toFixed(1)} out of 5</span> · {reviews.length} review{reviews.length > 1 ? "s" : ""}
          </div>
        ) : (
          <p className="mt-2 text-zinc-500">No reviews yet — be the first!</p>
        )}
        <div className="mt-4">
          <ReviewForm storeSlug={store.slug} productId={product.id} buttonClass={t.button} />
        </div>
        <ul className="mt-6 divide-y divide-zinc-100">
          {reviews.slice(0, 30).map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                <span className="font-semibold">{r.name}</span>
                {r.verified && <span className="rounded bg-emerald-100 px-1.5 text-xs font-medium text-emerald-800">✓ Verified buyer</span>}
                <span className="text-xs text-zinc-400">{formatDate(r.created_at)}</span>
              </div>
              {r.text && <p className="mt-2 whitespace-pre-line text-zinc-700">{r.text}</p>}
              {r.reply && (
                <p className="mt-2 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
                  <span className="font-semibold">{store.name}:</span> {r.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

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
