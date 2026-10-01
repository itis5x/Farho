import { PosScreen, type PosProduct } from "./screen";
import { requireStore } from "@/lib/auth";
import { listProducts, listStoreVariants, productOptions } from "@/lib/data";
import { getPaymentSettings } from "@/lib/payments/settings";

export const metadata = { title: "New order / POS" };

export default async function PosPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ mode?: string }> }) {
  const { storeId } = await params;
  const { mode } = await searchParams;
  const { store } = await requireStore(storeId);
  const [products, variants] = await Promise.all([listProducts(store.id, { activeOnly: true }), listStoreVariants(store.id)]);

  // One entry per sellable thing: a simple product, or each variant of a product with options.
  const items: PosProduct[] = products.flatMap((p) => {
    if (!productOptions(p).length)
      return [{ key: p.id, productId: p.id, name: p.name, variantTitle: "", price: p.price, stock: p.stock, image: p.image_url, codes: [p.barcode, p.sku].filter(Boolean) }];
    return variants
      .filter((v) => v.product_id === p.id)
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        key: `${p.id}:${v.id}`,
        productId: p.id,
        variantId: v.id,
        name: p.name,
        variantTitle: v.title,
        price: v.price ?? p.price,
        stock: v.stock,
        image: v.image_url || p.image_url,
        codes: [v.sku, p.barcode && `${p.barcode}`].filter(Boolean) as string[],
      }));
  });

  const pay = getPaymentSettings(store);
  return (
    <PosScreen
      storeId={store.id}
      store={{ name: store.name, address: store.address, phone: store.contact_phone, currency: store.currency, delivery: store.delivery_charge }}
      items={items}
      initialMode={mode === "delivery" ? "delivery" : "pos"}
      qrImage={pay.qr.enabled ? pay.qr.image_url : ""}
    />
  );
}
