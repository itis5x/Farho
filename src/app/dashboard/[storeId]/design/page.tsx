import { BrandForm } from "./editor";
import { DesignStudio } from "./studio";
import { requireStore } from "@/lib/auth";
import { parseLayout } from "@/lib/builder/schema";
import { TEMPLATES } from "@/lib/builder/templates";
import { listCategories } from "@/lib/data";

export const metadata = { title: "Website design" };

export default async function DesignPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const categories = await listCategories(store.id);
  const templates = TEMPLATES.map(({ id, name, description, preview, theme, primary_color, font }) => ({ id, name, description, preview, theme, primary_color, font }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Website design</h1>
        <p className="text-sm text-zinc-600">Build your homepage from sections, start from a template, add pages, or write your own code.</p>
      </div>
      <DesignStudio
        store={store}
        initial={parseLayout(store.layout, store)}
        categories={categories}
        templates={templates}
        brandForm={<BrandForm store={store} />}
      />
    </div>
  );
}
