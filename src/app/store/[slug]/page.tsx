import Link from "next/link";
import { ProductCard } from "@/components/storefront/product-card";
import { listCategories, listProducts } from "@/lib/data";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const t = THEME_STYLES[store.theme];
  const base = `/store/${store.slug}`;

  const [products, allCategories] = await Promise.all([
    listProducts(store.id, { activeOnly: true }),
    listCategories(store.id),
  ]);
  const featured = products.filter((p) => p.featured).slice(0, 8);
  const latest = products.slice(0, 12);
  const categories = allCategories
    .map((c) => {
      const inCat = products.filter((p) => p.category_id === c.id);
      return { ...c, count: inCat.length, cover: inCat.find((p) => p.image_url)?.image_url ?? null };
    })
    .filter((c) => c.count > 0);

  return (
    <>
      <Hero store={store} base={base} />

      {store.show_featured && featured.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-14">
          <SectionHeading title="Featured" theme={store.theme} />
          <div className={t.grid}>
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        </section>
      ) : null}

      {store.show_categories && categories.length > 0 ? (
        <section className={t.section}>
          <div className="mx-auto max-w-6xl px-4 py-14">
            <SectionHeading title="Shop by category" theme={store.theme} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`${base}/products?category=${c.slug}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-zinc-200"
                >
                  {c.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  )}
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-4">
                    <span className="text-lg font-semibold text-white">{c.name}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="flex items-end justify-between">
          <SectionHeading title="New arrivals" theme={store.theme} />
          <Link href={`${base}/products`} className="mb-6 text-sm font-medium text-brand hover:underline">
            View all →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            Products are coming soon. Check back shortly!
          </p>
        ) : (
          <div className={t.grid}>
            {latest.map((p) => (
              <ProductCard key={p.id} product={p} store={store} />
            ))}
          </div>
        )}
      </section>

      {store.show_about && store.about ? (
        <section className={t.section}>
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <SectionHeading title={`About ${store.name}`} theme={store.theme} center />
            <p className="whitespace-pre-line leading-relaxed text-zinc-700">{store.about}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}

function Hero({ store, base }: { store: Awaited<ReturnType<typeof getStorefront>>["store"]; base: string }) {
  const t = THEME_STYLES[store.theme];
  const cta = (
    <Link href={`${base}/products`} className={cn("inline-block bg-brand px-8 py-3 font-semibold text-white hover:opacity-90", t.button)}>
      Shop now
    </Link>
  );

  if (store.theme === "minimal") {
    return (
      <section className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-4xl font-light tracking-tight sm:text-6xl">{store.hero_title || store.name}</h1>
        {store.hero_subtitle && <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600">{store.hero_subtitle}</p>}
        <div className="mt-10">{cta}</div>
        {store.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.hero_image_url} alt="" className="mt-14 aspect-[21/9] w-full object-cover" />
        )}
      </section>
    );
  }

  if (store.theme === "modern") {
    return (
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand p-8 text-white sm:p-12 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{store.hero_title || store.name}</h1>
            {store.hero_subtitle && <p className="mt-4 text-lg text-white/85">{store.hero_subtitle}</p>}
            <Link
              href={`${base}/products`}
              className={cn("mt-8 inline-block bg-white px-8 py-3 font-semibold text-brand hover:opacity-90", t.button)}
            >
              Shop now
            </Link>
          </div>
          {store.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.hero_image_url} alt="" className="aspect-square w-full rounded-2xl object-cover shadow-2xl" />
          ) : (
            <div className="hidden aspect-square rounded-2xl bg-white/10 md:block" />
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden bg-zinc-900">
      {store.hero_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={store.hero_image_url} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
      ) : (
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand to-zinc-900" />
      )}
      <div className="mx-auto max-w-6xl px-4 py-24 text-white sm:py-32">
        <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">{store.hero_title || store.name}</h1>
        {store.hero_subtitle && <p className="mt-4 max-w-xl text-lg text-white/85">{store.hero_subtitle}</p>}
        <div className="mt-8">{cta}</div>
      </div>
    </section>
  );
}

function SectionHeading({ title, theme, center }: { title: string; theme: string; center?: boolean }) {
  return (
    <h2
      className={cn(
        "mb-6",
        theme === "minimal" ? "text-center text-sm font-semibold uppercase tracking-[0.3em]" : "text-2xl font-bold",
        center && "text-center",
      )}
    >
      {title}
    </h2>
  );
}
