import { CheckoutForm } from "@/components/storefront/checkout-form";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  return <CheckoutForm storeSlug={store.slug} currency={store.currency} buttonClass={THEME_STYLES[store.theme].button} />;
}
