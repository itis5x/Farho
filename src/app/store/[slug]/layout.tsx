import type { Metadata } from "next";
import Link from "next/link";
import { CartButton, CartProvider } from "@/components/storefront/cart";
import { ChatWidget } from "@/components/storefront/chat-widget";
import { parseLayout } from "@/lib/builder/schema";
import { getStorefront } from "@/lib/store-data";
import { FONT_CLASS, THEME_STYLES } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await getStorefront(slug);
  return {
    title: { default: store.name, template: `%s · ${store.name}` },
    description: store.tagline || store.about.slice(0, 160),
    openGraph: { title: store.name, description: store.tagline, images: store.hero_image_url ? [store.hero_image_url] : [] },
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { store, isOwner, hidden } = await getStorefront(slug);
  const t = THEME_STYLES[store.theme];
  const base = `/store/${store.slug}`;

  if (hidden) {
    return (
      <div className="grid min-h-screen place-items-center bg-white px-4 text-center">
        <div>
          <h1 className="text-3xl font-bold">{store.name}</h1>
          <p className="mt-2 text-zinc-600">We&apos;re getting ready. Coming soon!</p>
        </div>
      </div>
    );
  }

  const centered = store.theme === "minimal";
  const layout = parseLayout(store.layout, store);
  const menuPages = layout.pages.filter((p) => p.in_menu);
  // Custom CSS is the store owner's own; escape "</" so it can't close the style tag.
  const css = layout.custom_css.replace(/<\//g, "<\\/");
  return (
    <CartProvider storeSlug={store.slug}>
      <div
        className={cn("flex min-h-screen flex-col bg-white text-zinc-900", FONT_CLASS[store.font])}
        style={{ ["--brand" as string]: store.primary_color }}
      >
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        {isOwner && (
          <div className="flex items-center justify-center gap-3 bg-zinc-900 px-4 py-1.5 text-xs text-white">
            {store.published ? "You're viewing your live store." : "Preview — your store is unpublished."}
            <Link href={`/dashboard/${store.id}`} className="font-semibold underline">
              Open admin panel
            </Link>
          </div>
        )}
        {store.announcement && (
          <div className="bg-brand px-4 py-2 text-center text-sm font-medium text-white">{store.announcement}</div>
        )}
        <header className={cn("sticky top-0 z-20", t.header)}>
          <div
            className={cn(
              "mx-auto flex max-w-6xl items-center gap-6 px-4 py-4",
              centered ? "flex-col gap-3" : "justify-between",
              t.headerText,
            )}
          >
            <Link href={base} className="flex items-center gap-3">
              {store.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={store.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />
              )}
              <span className={cn("text-xl font-bold", centered && "text-2xl tracking-[0.2em] uppercase")}>{store.name}</span>
            </Link>
            <nav className={cn("flex items-center gap-4 whitespace-nowrap text-sm font-medium sm:gap-6", centered && "w-full justify-center")}>
              <Link href={base} className="hidden hover:opacity-70 sm:inline">
                Home
              </Link>
              <Link href={`${base}/products`} className="hover:opacity-70">
                Shop
              </Link>
              {menuPages.slice(0, 3).map((p) => (
                <Link key={p.slug} href={`${base}/pages/${p.slug}`} className="hidden hover:opacity-70 md:inline">
                  {p.title}
                </Link>
              ))}
              <Link href={`${base}/track`} className="hover:opacity-70">
                Track order
              </Link>
              <CartButton href={`${base}/cart`} className={centered ? "absolute right-4 top-5" : ""} />
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>
        {store.published && <ChatWidget storeSlug={store.slug} storeName={store.name} />}

        <footer className="mt-16 border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3">
            <div>
              <div className="text-lg font-bold">{store.name}</div>
              {store.tagline && <p className="mt-1 text-zinc-600">{store.tagline}</p>}
            </div>
            <div className="space-y-1 text-zinc-600">
              <div className="font-semibold text-zinc-900">Contact</div>
              {store.contact_phone && <p>📞 {store.contact_phone}</p>}
              {store.contact_email && <p>✉️ {store.contact_email}</p>}
              {store.address && <p>📍 {store.address}</p>}
            </div>
            <div className="space-y-1">
              {layout.pages.length > 0 && (
                <div className="mb-3 flex flex-col gap-1 text-zinc-600">
                  {layout.pages.map((p) => (
                    <Link key={p.slug} href={`${base}/pages/${p.slug}`} className="hover:text-brand">
                      {p.title}
                    </Link>
                  ))}
                </div>
              )}
              <div className="font-semibold">Follow us</div>
              <div className="flex gap-3 text-zinc-600">
                {store.facebook_url && <a href={store.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Facebook</a>}
                {store.instagram_url && <a href={store.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Instagram</a>}
                {store.tiktok_url && <a href={store.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:text-brand">TikTok</a>}
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500">
            © {new Date().getFullYear()} {store.name} · Powered by{" "}
            <Link href="/" className="font-semibold hover:underline">
              Farho
            </Link>
          </div>
        </footer>
      </div>
    </CartProvider>
  );
}
