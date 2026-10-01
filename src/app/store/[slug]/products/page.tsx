import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { listCategories, listProducts } from "@/lib/data";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Shop" };

const SORTS = {
  new: (a: Product, b: Product) => b.created_at.localeCompare(a.created_at),
  "price-asc": (a: Product, b: Product) => a.price - b.price,
  "price-desc": (a: Product, b: Product) => b.price - a.price,
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

  const [categories, all] = await Promise.all([listCategories(store.id), listProducts(store.id, { activeOnly: true })]);
  const active = categories.find((c) => c.slug === sp.category);
  const needle = q.toLowerCase();
  const products = all
    .filter((p) => !active || p.category_id === active.id)
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle))
    .sort((a, b) => Number(a.stock === 0) - Number(b.stock === 0) || SORTS[sort](a, b));

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
