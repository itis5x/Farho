import { RenderSection, type SectionData } from "@/components/storefront/sections";
import { parseLayout } from "@/lib/builder/schema";
import { listCategories, listProducts } from "@/lib/data";
import { getStorefront } from "@/lib/store-data";

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;
  const layout = parseLayout(store.layout, store);

  const [products, allCategories] = await Promise.all([listProducts(store.id, { activeOnly: true }), listCategories(store.id)]);
  const categories = allCategories
    .map((c) => {
      const inCat = products.filter((p) => p.category_id === c.id);
      return { ...c, count: inCat.length, cover: inCat.find((p) => p.image_url)?.image_url ?? null };
    })
    .filter((c) => c.count > 0);
  const data: SectionData = { store, products, categories };

  const visible = layout.sections.filter((s) => !s.hidden);
  return (
    <>
      {visible.map((s) => (
        <RenderSection key={s.id} section={s} data={data} />
      ))}
      {visible.length === 0 && (
        <p className="mx-auto max-w-xl px-4 py-24 text-center text-zinc-500">This store is being designed. Check back soon!</p>
      )}
    </>
  );
}
