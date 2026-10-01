import { ActionForm } from "@/components/action-form";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { createCategory, deleteCategory, renameCategory } from "@/lib/actions/catalog";
import { requireStore } from "@/lib/auth";
import { listCategories, listProducts } from "@/lib/data";

export const metadata = { title: "Categories" };

export default async function CategoriesPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const [cats, products] = await Promise.all([listCategories(store.id), listProducts(store.id)]);
  const categories = cats.map((c) => ({ ...c, product_count: products.filter((p) => p.category_id === c.id).length }));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-zinc-600">Group products so customers can browse your store easily.</p>
      </div>
      <div className="card p-5">
        <ActionForm action={createCategory.bind(null, store.id)}>
          <label className="label" htmlFor="name">New category</label>
          <div className="flex gap-2">
            <input id="name" name="name" className="input" placeholder="e.g. T-shirts" required />
            <SubmitButton pendingText="Adding…">Add</SubmitButton>
          </div>
        </ActionForm>
      </div>
      <div className="card divide-y divide-zinc-100">
        {categories.length === 0 && <p className="p-5 text-sm text-zinc-500">No categories yet.</p>}
        {categories.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <form action={renameCategory.bind(null, store.id, c.id)} className="flex flex-1 items-center gap-2">
              <input name="name" defaultValue={c.name} className="input max-w-xs" aria-label="Category name" />
              <SubmitButton className="btn-secondary px-3 py-1.5">Rename</SubmitButton>
            </form>
            <span className="text-sm text-zinc-500">{c.product_count} products</span>
            <form action={deleteCategory.bind(null, store.id, c.id)}>
              <ConfirmButton
                className="btn px-3 py-1.5 text-rose-600 hover:bg-rose-50"
                message={`Delete “${c.name}”? Products in it will become uncategorised.`}
              >
                Delete
              </ConfirmButton>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
