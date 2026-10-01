import { CheckoutForm } from "@/components/storefront/checkout-form";
import { availableMethods } from "@/lib/payments/service";
import { getPaymentSettings } from "@/lib/payments/settings";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";

export const metadata = { title: "Checkout" };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const settings = getPaymentSettings(store);
  return (
    <CheckoutForm
      storeSlug={store.slug}
      currency={store.currency}
      buttonClass={THEME_STYLES[store.theme].button}
      methods={await availableMethods(store)}
      qr={{ label: settings.qr.label, image: settings.qr.image_url, instructions: settings.qr.instructions }}
      bankDetails={settings.bank.details}
      codLabel={settings.cod.label}
    />
  );
}
