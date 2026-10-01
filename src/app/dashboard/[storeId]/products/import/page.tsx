import Link from "next/link";
import { ImportForm } from "./form";
import { requireStore } from "@/lib/auth";

export const metadata = { title: "Import products" };

export default async function ImportPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/${store.id}/products`} className="text-sm text-zinc-500 hover:underline">← Products</Link>
        <h1 className="mt-1 text-2xl font-bold">Import products</h1>
        <p className="text-sm text-zinc-600">Move your catalogue from a spreadsheet, Blanxer, Daraz or any other platform in one go.</p>
      </div>
      <div className="card space-y-3 p-5 text-sm">
        <p>
          Upload a <strong>CSV</strong> file (in Excel or Google Sheets: File → Download → CSV). The first row must be column names. Only{" "}
          <code>name</code> and <code>price</code> are required:
        </p>
        <code className="block overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs">
          name, price, compare_at_price, cost_price, stock, sku, barcode, category, image_url, description, active, featured
        </code>
        <p className="text-zinc-600">
          Products with the same SKU (or name) are updated instead of duplicated. New categories are created automatically. Tip:{" "}
          <a href={`/api/export/products/${store.id}`} className="text-indigo-600 underline">export your current products</a> to get a ready-made template.
        </p>
      </div>
      <ImportForm storeId={store.id} />
    </div>
  );
}
