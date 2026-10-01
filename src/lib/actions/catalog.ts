"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState, Store } from "@/lib/types";
import { resolveImage } from "@/lib/uploads";
import { slugify } from "@/lib/utils";

function uniqueSlug(table: "products" | "categories", storeId: number, base: string, excludeId?: number) {
  const root = base || "item";
  let slug = root;
  for (let i = 2; ; i++) {
    const hit = db
      .prepare(`SELECT id FROM ${table} WHERE store_id = ? AND slug = ? AND id != ?`)
      .get(storeId, slug, excludeId ?? 0);
    if (!hit) return slug;
    slug = `${root}-${i}`;
  }
}

function refresh(store: Store) {
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().min(0).nullable(),
);

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(120),
  description: z.string().trim().max(5000).default(""),
  price: z.coerce.number({ message: "Enter a valid price." }).min(0, "Price can't be negative."),
  compare_at_price: optionalNumber,
  stock: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int("Stock must be a whole number.").min(0).nullable(),
  ),
  sku: z.string().trim().max(60).default(""),
  category_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().nullable()),
  active: z.preprocess((v) => (v === "on" ? 1 : 0), z.number()),
  featured: z.preprocess((v) => (v === "on" ? 1 : 0), z.number()),
});

export async function saveProduct(
  storeId: number,
  productId: number | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.compare_at_price != null && d.compare_at_price <= d.price) d.compare_at_price = null;
  if (d.category_id != null) {
    const ok = db.prepare("SELECT 1 FROM categories WHERE id = ? AND store_id = ?").get(d.category_id, store.id);
    if (!ok) d.category_id = null;
  }

  const existing = productId
    ? (db.prepare("SELECT image_url FROM products WHERE id = ? AND store_id = ?").get(productId, store.id) as
        | { image_url: string }
        | undefined)
    : undefined;
  if (productId && !existing) return { error: "Product not found." };

  let image: string;
  try {
    image = await resolveImage(form, "image_url", existing?.image_url ?? "");
  } catch (e) {
    return { error: (e as Error).message };
  }

  const slug = uniqueSlug("products", store.id, slugify(d.name), productId ?? undefined);
  if (productId) {
    db.prepare(
      `UPDATE products SET name=?, slug=?, description=?, price=?, compare_at_price=?, stock=?, sku=?, category_id=?,
         active=?, featured=?, image_url=? WHERE id=? AND store_id=?`,
    ).run(d.name, slug, d.description, d.price, d.compare_at_price, d.stock, d.sku, d.category_id, d.active, d.featured, image, productId, store.id);
  } else {
    db.prepare(
      `INSERT INTO products (store_id, name, slug, description, price, compare_at_price, stock, sku, category_id, active, featured, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(store.id, d.name, slug, d.description, d.price, d.compare_at_price, d.stock, d.sku, d.category_id, d.active, d.featured, image);
  }
  refresh(store);
  redirect(`/dashboard/${store.id}/products?saved=1`);
}

export async function deleteProduct(storeId: number, productId: number) {
  const { store } = await requireStore(storeId);
  db.prepare("DELETE FROM products WHERE id = ? AND store_id = ?").run(productId, store.id);
  refresh(store);
  redirect(`/dashboard/${store.id}/products`);
}

export async function toggleProduct(storeId: number, productId: number) {
  const { store } = await requireStore(storeId);
  db.prepare("UPDATE products SET active = 1 - active WHERE id = ? AND store_id = ?").run(productId, store.id);
  refresh(store);
}

export async function createCategory(storeId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Category name is required." };
  if (name.length > 60) return { error: "Category name is too long." };
  db.prepare("INSERT INTO categories (store_id, name, slug) VALUES (?, ?, ?)").run(
    store.id,
    name,
    uniqueSlug("categories", store.id, slugify(name)),
  );
  refresh(store);
  return { ok: `Added “${name}”.` };
}

export async function renameCategory(storeId: number, categoryId: number, form: FormData) {
  const { store } = await requireStore(storeId);
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  db.prepare("UPDATE categories SET name = ?, slug = ? WHERE id = ? AND store_id = ?").run(
    name,
    uniqueSlug("categories", store.id, slugify(name), categoryId),
    categoryId,
    store.id,
  );
  refresh(store);
}

export async function deleteCategory(storeId: number, categoryId: number) {
  const { store } = await requireStore(storeId);
  db.prepare("DELETE FROM categories WHERE id = ? AND store_id = ?").run(categoryId, store.id);
  refresh(store);
}

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Code must be at least 3 characters.")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Code can only contain letters, numbers, - and _."),
  kind: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive("Discount must be more than 0."),
  min_subtotal: z.coerce.number().min(0).default(0),
});

export async function createCoupon(storeId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = couponSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.kind === "percent" && d.value > 100) return { error: "Percentage discount can't exceed 100%." };
  if (db.prepare("SELECT 1 FROM coupons WHERE store_id = ? AND code = ?").get(store.id, d.code)) {
    return { error: "A coupon with this code already exists." };
  }
  db.prepare("INSERT INTO coupons (store_id, code, kind, value, min_subtotal) VALUES (?, ?, ?, ?, ?)").run(
    store.id,
    d.code,
    d.kind,
    d.value,
    d.min_subtotal,
  );
  revalidatePath(`/dashboard/${store.id}/coupons`);
  return { ok: `Coupon ${d.code} created.` };
}

export async function toggleCoupon(storeId: number, couponId: number) {
  const { store } = await requireStore(storeId);
  db.prepare("UPDATE coupons SET active = 1 - active WHERE id = ? AND store_id = ?").run(couponId, store.id);
  revalidatePath(`/dashboard/${store.id}/coupons`);
}

export async function deleteCoupon(storeId: number, couponId: number) {
  const { store } = await requireStore(storeId);
  db.prepare("DELETE FROM coupons WHERE id = ? AND store_id = ?").run(couponId, store.id);
  revalidatePath(`/dashboard/${store.id}/coupons`);
}
