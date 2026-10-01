import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { requireStore } from "@/lib/auth";
import { listCategories } from "@/lib/data";

export const metadata = { title: "Add product" };

export default async function NewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const categories = await listCategories(store.id);
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard/${store.id}/products`} className="text-sm text-zinc-500 hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Add product</h1>
      </div>
      <ProductForm storeId={store.id} categories={categories} currency={store.currency} />
    </div>
  );
}
