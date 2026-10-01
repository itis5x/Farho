import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { db } from "@/lib/db";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import type { Category, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shop" };

const SORTS = {
  new: "p.created_at DESC, p.id DESC",
  "price-asc": "p.price ASC",
  "price-desc": "p.price DESC",
} as const;

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; q?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const t = THEME_STYLES[store.theme];
  const base = `/store/${store.slug}`;
  const q = (sp.q ?? "").trim();
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : "new") as keyof typeof SORTS;

  const categories = db.prepare("SELECT * FROM categories WHERE store_id = ? ORDER BY name").all(store.id) as Category[];
  const active = categories.find((c) => c.slug === sp.category);

  const products = db
    .prepare(
      `SELECT p.* FROM products p WHERE p.store_id = ? AND p.active = 1
         AND (? IS NULL OR p.category_id = ?) AND (p.name LIKE ? OR p.description LIKE ?)
       ORDER BY (p.stock = 0), ${SORTS[sort]}`,
    )
    .all(store.id, active?.id ?? null, active?.id ?? null, `%${q}%`, `%${q}%`) as Product[];

  const link = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const m = { category: active?.slug, q: q || undefined, sort: sort === "new" ? undefined : sort, ...o };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, v);
    return `${base}/products${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">{active ? active.name : "All products"}</h1>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Chip href={link({ category: undefined })} active={!active} button={t.button}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} href={link({ category: c.slug })} active={active?.id === c.id} button={t.button}>
              {c.name}
            </Chip>
          ))}
        </div>
        <form className="flex gap-2" action={`${base}/products`}>
          {active && <input type="hidden" name="category" value={active.slug} />}
          <input name="q" defaultValue={q} placeholder="Search products" className="input w-48" />
          <select name="sort" defaultValue={sort} className="input w-40">
            <option value="new">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
          <button className={cn("bg-brand px-4 text-sm font-medium text-white", t.button)}>Go</button>
        </form>
      </div>
      <div className="mt-8">
        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">No products found.</p>
        ) : (
          <div className={t.grid}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ href, active, button, children }: { href: string; active: boolean; button: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "border px-4 py-1.5 text-sm",
        button,
        active ? "border-brand bg-brand text-white" : "border-zinc-300 hover:border-zinc-400",
      )}
    >
      {children}
    </Link>
  );
}
