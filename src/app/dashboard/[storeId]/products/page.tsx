import Link from "next/link";
import { requireStore } from "@/lib/auth";
import { toggleProduct } from "@/lib/actions/catalog";
import { listCategories, listProducts, unitsSoldByProduct } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Products" };

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string; saved?: string }>;
}) {
  const { storeId } = await params;
  const { q = "", saved } = await searchParams;
  const { store } = await requireStore(storeId);
  const [all, categories, sold] = await Promise.all([
    listProducts(store.id),
    listCategories(store.id),
    unitsSoldByProduct(store.id),
  ]);
  const needle = q.trim().toLowerCase();
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const products = all
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle))
    .map((p) => ({ ...p, category_name: catName.get(p.category_id) ?? null, sold: sold.get(p.id) ?? 0 }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-zinc-600">{products.length} products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/${store.id}/products/labels`} className="btn-secondary">🏷️ Barcode labels</Link>
          <Link href={`/dashboard/${store.id}/products/import`} className="btn-secondary">⬆ Import CSV</Link>
          <a href={`/api/export/products/${store.id}`} className="btn-secondary">⬇ Export CSV</a>
          <Link href={`/dashboard/${store.id}/products/new`} className="btn-primary">
            + Add product
          </Link>
        </div>
      </div>
      {saved && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Product saved.</p>}
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search by name or SKU" className="input max-w-sm" />
        <button className="btn-secondary">Search</button>
      </form>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl">🏷️</div>
          <p className="mt-3 font-medium">{q ? "No products match your search." : "No products yet"}</p>
          {!q && (
            <Link href={`/dashboard/${store.id}/products/new`} className="btn-primary mt-4">
              Add your first product
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Sold</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/${store.id}/products/${p.id}`} className="flex items-center gap-3">
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-zinc-100" />
                      )}
                      <div>
                        <div className="font-medium">
                          {p.name} {p.featured ? <span title="Featured">⭐</span> : null}
                        </div>
                        <div className="text-xs text-zinc-500">{p.category_name ?? "Uncategorised"}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(p.price, store.currency)}
                    {p.compare_at_price && (
                      <div className="text-xs text-zinc-400 line-through">{formatMoney(p.compare_at_price, store.currency)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.stock == null ? (
                      <span className="text-zinc-400">∞</span>
                    ) : p.stock === 0 ? (
                      <span className="font-medium text-rose-600">Sold out</span>
                    ) : (
                      p.stock
                    )}
                  </td>
                  <td className="px-4 py-3">{p.sold}</td>
                  <td className="px-4 py-3">
                    <form action={toggleProduct.bind(null, store.id, p.id)}>
                      <button
                        className={`badge cursor-pointer ${p.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}
                        title="Click to toggle"
                      >
                        {p.active ? "Active" : "Hidden"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/dashboard/${store.id}/products/${p.id}`} className="text-indigo-600 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
