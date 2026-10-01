"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "@/lib/auth";
import { parseCsv } from "@/lib/csv";
import { createCategoryRow, createProductRow, listCategories, listProducts, updateProductRow } from "@/lib/data";
import type { FormState } from "@/lib/types";
import { slugify } from "@/lib/utils";

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/[,\s]|rs\.?/gi, ""));
  return v?.trim() && Number.isFinite(n) && n >= 0 ? n : null;
};
const yes = (v: string | undefined, dflt: boolean) => (v?.trim() ? /^(y|yes|true|1|on)$/i.test(v.trim()) : dflt);

/** Imports products from CSV. Rows with a known SKU (or the same name) update the existing product. */
export async function importProducts(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a CSV file." };
  if (file.size > 2 * 1024 * 1024) return { error: "The file is larger than 2 MB." };
  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file has no product rows." };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (row: string[], ...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return row[i]?.trim() ?? "";
    }
    return undefined;
  };
  if (!header.includes("name") && !header.includes("title")) return { error: "The first row needs a “name” column." };

  const [existing, categories] = await Promise.all([listProducts(store.id), listCategories(store.id)]);
  const bySku = new Map(existing.filter((p) => p.sku).map((p) => [p.sku.toLowerCase(), p]));
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const usedSlugs = new Set(existing.map((p) => p.slug));

  let created = 0;
  let updated = 0;
  const problems: string[] = [];
  for (const [i, row] of rows.slice(1, 1001).entries()) {
    const name = col(row, "name", "title") ?? "";
    const price = num(col(row, "price", "selling_price"));
    if (!name || price == null) {
      problems.push(`row ${i + 2}`);
      continue;
    }
    let categoryId = "";
    const catName = col(row, "category", "collection");
    if (catName) {
      categoryId = catByName.get(catName.toLowerCase()) ?? "";
      if (!categoryId) {
        let slug = slugify(catName) || "category";
        while (categories.some((c) => c.slug === slug)) slug += "-2";
        const c = await createCategoryRow(store.id, catName.slice(0, 100), slug);
        categories.push(c);
        catByName.set(catName.toLowerCase(), c.id);
        categoryId = c.id;
      }
    }
    const sku = (col(row, "sku") ?? "").slice(0, 80);
    const image = col(row, "image_url", "image", "photo") ?? "";
    const data = {
      name: name.slice(0, 150),
      price,
      compare_at_price: num(col(row, "compare_at_price", "mrp", "original_price")),
      cost_price: num(col(row, "cost_price", "cost")),
      stock: num(col(row, "stock", "quantity", "qty")),
      sku,
      barcode: (col(row, "barcode") ?? "").slice(0, 40),
      category_id: categoryId,
      image_url: /^https?:\/\//.test(image) ? image.slice(0, 500) : "",
      description: (col(row, "description") ?? "").slice(0, 5000),
      active: yes(col(row, "active", "visible"), true),
      featured: yes(col(row, "featured"), false),
    };
    if (data.compare_at_price != null && data.compare_at_price <= price) data.compare_at_price = null;
    if (data.stock != null) data.stock = Math.floor(data.stock);

    const match = (sku && bySku.get(sku.toLowerCase())) || byName.get(name.toLowerCase());
    if (match) {
      // Only overwrite what the file actually fills in; empty cells keep the current values.
      const given = (...names: string[]) => (col(row, ...names) ?? "") !== "";
      const patch: Partial<typeof data> = { name: data.name, price: data.price };
      if (given("compare_at_price", "mrp", "original_price")) patch.compare_at_price = data.compare_at_price;
      if (given("cost_price", "cost")) patch.cost_price = data.cost_price;
      if (given("stock", "quantity", "qty")) patch.stock = data.stock;
      if (given("sku")) patch.sku = data.sku;
      if (given("barcode")) patch.barcode = data.barcode;
      if (given("category", "collection")) patch.category_id = data.category_id;
      if (data.image_url) patch.image_url = data.image_url;
      if (given("description")) patch.description = data.description;
      if (given("active", "visible")) patch.active = data.active;
      if (given("featured")) patch.featured = data.featured;
      await updateProductRow(match.id, patch);
      updated++;
    } else {
      let slug = slugify(name) || "item";
      for (let n = 2; usedSlugs.has(slug); n++) slug = `${slugify(name) || "item"}-${n}`;
      usedSlugs.add(slug);
      const p = await createProductRow({ ...data, slug, store_id: store.id, images: "", options: "" });
      byName.set(name.toLowerCase(), p);
      if (sku) bySku.set(sku.toLowerCase(), p);
      created++;
    }
  }
  revalidatePath(`/dashboard/${store.id}`, "layout");
  revalidatePath(`/store/${store.slug}`, "layout");
  const skipped = problems.length ? ` Skipped ${problems.length} row(s) without a name or price (${problems.slice(0, 5).join(", ")}${problems.length > 5 ? "…" : ""}).` : "";
  return { ok: `Imported ${created} new and updated ${updated} existing product(s).${skipped}` };
}
