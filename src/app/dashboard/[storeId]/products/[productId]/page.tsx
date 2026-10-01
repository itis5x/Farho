import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmButton } from "@/components/form";
import { ProductForm } from "@/components/product-form";
import { deleteProduct } from "@/lib/actions/catalog";
import { requireStore } from "@/lib/auth";
import { getProduct, listCategories } from "@/lib/data";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ storeId: string; productId: string }>;
}) {
  const { storeId, productId } = await params;
  const { store } = await requireStore(storeId);
  const [product, categories] = await Promise.all([getProduct(store.id, productId), listCategories(store.id)]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/dashboard/${store.id}/products`} className="text-sm text-zinc-500 hover:underline">
            ← Products
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
        </div>
        <div className="flex gap-2">
          <a href={`/store/${store.slug}/p/${product.slug}`} target="_blank" className="btn-secondary">
            View on website ↗
          </a>
          <form action={deleteProduct.bind(null, store.id, product.id)}>
            <ConfirmButton message={`Delete “${product.name}”? This can't be undone.`}>Delete</ConfirmButton>
          </form>
        </div>
      </div>
      <ProductForm storeId={store.id} product={product} categories={categories} currency={store.currency} />
    </div>
  );
}
