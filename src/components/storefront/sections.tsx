import Link from "next/link";
import type { Section } from "@/lib/builder/schema";
import { THEME_STYLES } from "@/lib/storefront";
import type { Category, Product, Store } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Countdown } from "./countdown";
import { ProductCard } from "./product-card";

export type SectionData = { store: Store; products: Product[]; categories: (Category & { cover: string | null; count: number })[] };

const pad = "mx-auto max-w-6xl px-4";

/** Section links like "/products" are relative to the store. */
function href(store: Store, link: string) {
  if (!link) return `/store/${store.slug}/products`;
  return link.startsWith("/") ? `/store/${store.slug}${link === "/" ? "" : link}` : link;
}

function Button({ store, text, link, light }: { store: Store; text: string; link: string; light?: boolean }) {
  if (!text) return null;
  const t = THEME_STYLES[store.theme];
  return (
    <Link
      href={href(store, link)}
      className={cn(
        "inline-block px-8 py-3 font-semibold transition hover:opacity-90",
        t.button,
        light ? "bg-white text-brand" : "bg-brand text-white",
      )}
    >
      {text}
    </Link>
  );
}

function Heading({ store, children, center }: { store: Store; children: React.ReactNode; center?: boolean }) {
  if (!children) return null;
  return (
    <h2
      className={cn(
        "mb-6",
        store.theme === "minimal" ? "text-center text-sm font-semibold uppercase tracking-[0.3em]" : "text-2xl font-bold",
        center && "text-center",
      )}
    >
      {children}
    </h2>
  );
}

function youtubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export function RenderSection({ section: s, data }: { section: Section; data: SectionData }) {
  const { store } = data;
  const t = THEME_STYLES[store.theme];

  switch (s.type) {
    case "hero": {
      if (s.style === "centered")
        return (
          <section className={cn(pad, "py-20 text-center")}>
            <h1 className="text-4xl font-light tracking-tight sm:text-6xl">{s.title || store.name}</h1>
            {s.subtitle && <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-600">{s.subtitle}</p>}
            <div className="mt-10">
              <Button store={store} text={s.button_text} link={s.button_link} />
            </div>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="mt-14 aspect-[21/9] w-full object-cover" />
            )}
          </section>
        );
      if (s.style === "split")
        return (
          <section className={cn(pad, "pt-6")}>
            <div className="grid items-center gap-8 overflow-hidden rounded-3xl bg-brand p-8 text-white sm:p-12 md:grid-cols-2">
              <div>
                <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{s.title || store.name}</h1>
                {s.subtitle && <p className="mt-4 text-lg text-white/85">{s.subtitle}</p>}
                <div className="mt-8">
                  <Button store={store} text={s.button_text} link={s.button_link} light />
                </div>
              </div>
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="aspect-square w-full rounded-2xl object-cover shadow-2xl" />
              ) : (
                <div className="hidden aspect-square rounded-2xl bg-white/10 md:block" />
              )}
            </div>
          </section>
        );
      if (s.style === "gradient")
        return (
          <section className="bg-gradient-to-br from-brand via-brand/80 to-zinc-900 text-white">
            <div className={cn(pad, "py-24 text-center sm:py-32")}>
              <h1 className="mx-auto max-w-3xl text-4xl font-extrabold sm:text-6xl">{s.title || store.name}</h1>
              {s.subtitle && <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">{s.subtitle}</p>}
              <div className="mt-9">
                <Button store={store} text={s.button_text} link={s.button_link} light />
              </div>
            </div>
          </section>
        );
      return (
        <section className="relative isolate overflow-hidden bg-zinc-900">
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-60" />
          ) : (
            <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand to-zinc-900" />
          )}
          <div className={cn(pad, "py-24 text-white sm:py-32")}>
            <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">{s.title || store.name}</h1>
            {s.subtitle && <p className="mt-4 max-w-xl text-lg text-white/85">{s.subtitle}</p>}
            <div className="mt-8">
              <Button store={store} text={s.button_text} link={s.button_link} />
            </div>
          </div>
        </section>
      );
    }

    case "products": {
      let list = data.products;
      if (s.source === "featured") list = list.filter((p) => p.featured);
      if (s.source === "sale") list = list.filter((p) => p.compare_at_price && p.compare_at_price > p.price);
      if (s.source === "category") list = list.filter((p) => p.category_id === s.category_id);
      list = list.slice(0, s.limit);
      if (!list.length) return null;
      return (
        <section className={cn(pad, "py-14")}>
          <div className="flex items-end justify-between">
            <Heading store={store}>{s.title}</Heading>
            <Link href={`/store/${store.slug}/products`} className="mb-6 text-sm font-medium text-brand hover:underline">
              View all →
            </Link>
          </div>
          {s.layout === "carousel" ? (
            <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
              {list.map((p) => (
                <div key={p.id} className="w-56 shrink-0 snap-start">
                  <ProductCard product={p} store={store} />
                </div>
              ))}
            </div>
          ) : (
            <div className={t.grid}>
              {list.map((p) => (
                <ProductCard key={p.id} product={p} store={store} />
              ))}
            </div>
          )}
        </section>
      );
    }

    case "categories":
      if (!data.categories.length) return null;
      return (
        <section className={t.section}>
          <div className={cn(pad, "py-14")}>
            <Heading store={store}>{s.title}</Heading>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {data.categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/store/${store.slug}/products?category=${c.slug}`}
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
      );

    case "banner": {
      const tone = s.tone === "dark" ? "bg-zinc-900 text-white" : s.tone === "light" ? "bg-zinc-100 text-zinc-900" : "bg-brand text-white";
      return (
        <section className={cn(pad, "py-8")}>
          <div className={cn("relative isolate overflow-hidden rounded-2xl px-8 py-12 sm:px-12", tone)}>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30" />
            )}
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">{s.title}</h2>
                {s.text && <p className="mt-2 opacity-85">{s.text}</p>}
              </div>
              <Button store={store} text={s.button_text} link={s.button_link} light={s.tone !== "light"} />
            </div>
          </div>
        </section>
      );
    }

    case "image_text":
      return (
        <section className={cn(pad, "py-14")}>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className={cn(s.image_side === "right" && "md:order-2")}>
              {s.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              ) : (
                <div className="aspect-square w-full rounded-2xl bg-zinc-100" />
              )}
            </div>
            <div>
              <h2 className="text-3xl font-bold">{s.title}</h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed text-zinc-700">{s.text}</p>
              {s.button_text && (
                <div className="mt-6">
                  <Button store={store} text={s.button_text} link={s.button_link} />
                </div>
              )}
            </div>
          </div>
        </section>
      );

    case "text":
      return (
        <section className={t.section}>
          <div className={cn("mx-auto max-w-3xl px-4 py-16", s.align === "center" && "text-center")}>
            <Heading store={store} center={s.align === "center"}>
              {s.title}
            </Heading>
            <p className="whitespace-pre-line leading-relaxed text-zinc-700">{s.text}</p>
          </div>
        </section>
      );

    case "perks":
      if (!s.items.length) return null;
      return (
        <section className="border-y border-zinc-100 bg-white">
          <div className={cn(pad, "grid gap-6 py-8 sm:grid-cols-3")}>
            {s.items.map((it, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand/10 text-2xl">{it.icon}</span>
                <div>
                  <div className="font-semibold">{it.title}</div>
                  <div className="text-sm text-zinc-600">{it.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      );

    case "testimonials":
      if (!s.items.length) return null;
      return (
        <section className={t.section}>
          <div className={cn(pad, "py-14")}>
            <Heading store={store} center>
              {s.title}
            </Heading>
            <div className="grid gap-6 md:grid-cols-3">
              {s.items.map((it, i) => (
                <figure key={i} className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="text-amber-400">{"★".repeat(it.rating)}<span className="text-zinc-200">{"★".repeat(5 - it.rating)}</span></div>
                  <blockquote className="mt-3 text-zinc-700">“{it.text}”</blockquote>
                  <figcaption className="mt-4 font-semibold">— {it.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );

    case "faq":
      if (!s.items.length) return null;
      return (
        <section className="mx-auto max-w-3xl px-4 py-14">
          <Heading store={store} center>
            {s.title}
          </Heading>
          <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200">
            {s.items.map((it, i) => (
              <details key={i} className="group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {it.q}
                  <span className="text-zinc-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-zinc-600">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );

    case "video": {
      const id = youtubeId(s.url);
      if (!id) return null;
      return (
        <section className={cn(pad, "py-14")}>
          <Heading store={store} center>
            {s.title}
          </Heading>
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title={s.title || "Video"}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      );
    }

    case "gallery":
      if (!s.images.length) return null;
      return (
        <section className={cn(pad, "py-14")}>
          <Heading store={store} center>
            {s.title}
          </Heading>
          <div className="columns-2 gap-4 sm:columns-3">
            {s.images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" className="mb-4 w-full break-inside-avoid rounded-xl" />
            ))}
          </div>
        </section>
      );

    case "countdown":
      return (
        <section className={cn(pad, "py-8")}>
          <div className="rounded-2xl bg-zinc-900 px-6 py-10 text-center text-white">
            <h2 className="text-2xl font-bold sm:text-3xl">{s.title}</h2>
            <Countdown endsAt={s.ends_at} />
            {s.text && <p className="mt-4 text-white/80">{s.text}</p>}
            <div className="mt-6">
              <Button store={store} text={s.button_text} link={s.button_link} />
            </div>
          </div>
        </section>
      );

    case "html":
      // Seller code runs in a sandboxed iframe with no access to the store's cookies, cart or checkout.
      return (
        <section className={cn(pad, "py-6")}>
          <iframe
            srcDoc={s.html}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            title="Custom section"
            className="w-full rounded-xl border-0"
            style={{ height: s.height }}
            loading="lazy"
          />
        </section>
      );

    case "spacer":
      return <div className={s.size === "sm" ? "h-6" : s.size === "lg" ? "h-24" : "h-12"} />;
  }
}
