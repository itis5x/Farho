import { CartView } from "@/components/storefront/cart-view";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";

export const metadata = { title: "Your cart" };

export default async function CartPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  return <CartView storeSlug={store.slug} currency={store.currency} buttonClass={THEME_STYLES[store.theme].button} />;
}
