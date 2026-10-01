import { toCsv } from "@/lib/csv";
import { listCategories, listProducts } from "@/lib/data";
import { csvResponse, ownedStore } from "@/lib/export-auth";

/** Same columns the product import accepts. */
export async function GET(_req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const store = await ownedStore((await params).storeId);
  if (!store) return new Response("Not found", { status: 404 });
  const [products, categories] = await Promise.all([listProducts(store.id), listCategories(store.id)]);
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const rows: unknown[][] = [["name", "price", "compare_at_price", "cost_price", "stock", "sku", "barcode", "category", "image_url", "description", "active", "featured"]];
  for (const p of products) {
    rows.push([p.name, p.price, p.compare_at_price ?? "", p.cost_price ?? "", p.stock ?? "", p.sku, p.barcode, cat.get(p.category_id) ?? "", p.image_url, p.description, p.active ? "yes" : "no", p.featured ? "yes" : "no"]);
  }
  return csvResponse(toCsv(rows), `${store.slug}-products.csv`);
}
