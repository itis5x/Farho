"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { createReview, deleteReview, findReviewByPhone, getProduct, getReview, getStoreBySlug, hasBought, updateReview } from "@/lib/data";
import type { FormState } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(80),
  phone: z.string().trim().max(20).default(""),
  rating: z.coerce.number().int().min(1, "Choose a star rating.").max(5),
  text: z.string().trim().max(1500).default(""),
});

/** A customer review. Buyers (phone matches a delivered order) are published right away; others wait for approval. */
export async function submitReview(storeSlug: string, productId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const store = await getStoreBySlug(storeSlug);
  const product = store?.published ? await getProduct(store.id, productId) : null;
  if (!store || !product) return { error: "This product isn't available." };
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const phone = d.phone.replace(/[\s-]/g, "");
  if (phone && !/^\+?\d{7,16}$/.test(phone)) return { error: "Please enter a valid phone number." };
  if (phone && (await findReviewByPhone(product.id, phone))) return { error: "You've already reviewed this product. Thank you!" };

  const verified = phone ? await hasBought(store.id, product.id, phone) : false;
  await createReview({ store_id: store.id, product_id: product.id, name: d.name, phone, rating: d.rating, text: d.text, verified, approved: verified });
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}/reviews`);
  return { ok: verified ? "Thanks! Your review is live." : "Thanks! Your review will appear after the store approves it." };
}

export async function moderateReview(storeId: string, reviewId: string, action: "approve" | "hide" | "delete") {
  const { store } = await requireStore(storeId);
  const review = await getReview(store.id, reviewId);
  if (!review) return;
  if (action === "delete") await deleteReview(review.id);
  else await updateReview(review.id, { approved: action === "approve" });
  revalidatePath(`/dashboard/${store.id}/reviews`);
  revalidatePath(`/store/${store.slug}`, "layout");
}

export async function replyToReview(storeId: string, reviewId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const review = await getReview(store.id, reviewId);
  if (!review) return;
  await updateReview(review.id, { reply: String(form.get("reply") ?? "").trim().slice(0, 1000) });
  revalidatePath(`/dashboard/${store.id}/reviews`);
  revalidatePath(`/store/${store.slug}`, "layout");
}
