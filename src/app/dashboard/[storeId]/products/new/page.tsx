import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Category } from "@/lib/types";

export const metadata = { title: "Add product" };

export default async function NewProductPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const categories = db.prepare("SELECT * FROM categories WHERE store_id = ? ORDER BY name").all(store.id) as Category[];
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
