"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isConflict } from "@/lib/appwrite";
import { requireStore } from "@/lib/auth";
import {
  categorySlugTaken,
  createCategoryRow,
  createCouponRow,
  createProductRow,
  deleteCategoryRow,
  deleteCouponRow,
  deleteProductRow,
  getCategory,
  getCoupon,
  getCouponByCode,
  getProduct,
  productSlugTaken,
  updateCategoryRow,
  updateCouponRow,
  updateProductRow,
} from "@/lib/data";
import type { FormState, Store } from "@/lib/types";
import { resolveImage } from "@/lib/uploads";
import { slugify } from "@/lib/utils";

async function uniqueSlug(
  taken: (storeId: string, slug: string, excludeId?: string) => Promise<boolean>,
  storeId: string,
  base: string,
  excludeId?: string,
) {
  const root = base || "item";
  let slug = root;
  for (let i = 2; await taken(storeId, slug, excludeId); i++) slug = `${root}-${i}`;
  return slug;
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
  name: z.string().trim().min(1, "Product name is required.").max(150),
  description: z.string().trim().max(5000).default(""),
  price: z.coerce.number({ message: "Enter a valid price." }).min(0, "Price can't be negative."),
  compare_at_price: optionalNumber,
  stock: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.coerce.number().int("Stock must be a whole number.").min(0).max(1_000_000).nullable(),
  ),
  sku: z.string().trim().max(80).default(""),
  category_id: z.string().trim().max(36).default(""),
  active: z.preprocess((v) => v === "on", z.boolean()),
  featured: z.preprocess((v) => v === "on", z.boolean()),
});

export async function saveProduct(
  storeId: string,
  productId: string | null,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = productSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.compare_at_price != null && d.compare_at_price <= d.price) d.compare_at_price = null;
  if (d.category_id && !(await getCategory(store.id, d.category_id))) d.category_id = "";

  const existing = productId ? await getProduct(store.id, productId) : null;
  if (productId && !existing) return { error: "Product not found." };

  let image: string;
  try {
    image = await resolveImage(form, "image_url", existing?.image_url ?? "");
  } catch (e) {
    return { error: (e as Error).message };
  }

  const slug = await uniqueSlug(productSlugTaken, store.id, slugify(d.name), productId ?? undefined);
  const data = { ...d, slug, image_url: image };
  if (existing) await updateProductRow(existing.id, data);
  else await createProductRow({ ...data, store_id: store.id });
  refresh(store);
  redirect(`/dashboard/${store.id}/products?saved=1`);
}

export async function deleteProduct(storeId: string, productId: string) {
  const { store } = await requireStore(storeId);
  if (await getProduct(store.id, productId)) await deleteProductRow(productId);
  refresh(store);
  redirect(`/dashboard/${store.id}/products`);
}

export async function toggleProduct(storeId: string, productId: string) {
  const { store } = await requireStore(storeId);
  const p = await getProduct(store.id, productId);
  if (p) await updateProductRow(p.id, { active: !p.active });
  refresh(store);
}

export async function createCategory(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Category name is required." };
  if (name.length > 100) return { error: "Category name is too long." };
  await createCategoryRow(store.id, name, await uniqueSlug(categorySlugTaken, store.id, slugify(name)));
  refresh(store);
  return { ok: `Added “${name}”.` };
}

export async function renameCategory(storeId: string, categoryId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  if (!name || !(await getCategory(store.id, categoryId))) return;
  await updateCategoryRow(categoryId, {
    name,
    slug: await uniqueSlug(categorySlugTaken, store.id, slugify(name), categoryId),
  });
  refresh(store);
}

export async function deleteCategory(storeId: string, categoryId: string) {
  const { store } = await requireStore(storeId);
  if (await getCategory(store.id, categoryId)) await deleteCategoryRow(categoryId);
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

export async function createCoupon(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = couponSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.kind === "percent" && d.value > 100) return { error: "Percentage discount can't exceed 100%." };
  if (await getCouponByCode(store.id, d.code)) return { error: "A coupon with this code already exists." };
  try {
    await createCouponRow({ ...d, store_id: store.id });
  } catch (e) {
    if (isConflict(e)) return { error: "A coupon with this code already exists." };
    throw e;
  }
  revalidatePath(`/dashboard/${store.id}/coupons`);
  return { ok: `Coupon ${d.code} created.` };
}

export async function toggleCoupon(storeId: string, couponId: string) {
  const { store } = await requireStore(storeId);
  const c = await getCoupon(store.id, couponId);
  if (c) await updateCouponRow(c.id, { active: !c.active });
  revalidatePath(`/dashboard/${store.id}/coupons`);
}

export async function deleteCoupon(storeId: string, couponId: string) {
  const { store } = await requireStore(storeId);
  if (await getCoupon(store.id, couponId)) await deleteCouponRow(couponId);
  revalidatePath(`/dashboard/${store.id}/coupons`);
}
