"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isConflict } from "@/lib/appwrite";
import { requireStore, requireUser } from "@/lib/auth";
import { createStoreRow, deleteStoreCascade, getStoreBySlug, updateStoreRow } from "@/lib/data";
import { FONTS, THEMES, type FormState } from "@/lib/types";
import { resolveImage } from "@/lib/uploads";
import { RESERVED_SLUGS, slugify } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().trim().min(2, "Store name must be at least 2 characters.").max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Store address must be at least 3 characters.")
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Store address can only contain letters, numbers and dashes."),
  tagline: z.string().trim().max(120).default(""),
  theme: z.enum(THEMES).default("classic"),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4f46e5"),
});

export async function createStore(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = Object.fromEntries(form);
  const parsed = createSchema.safeParse({ ...raw, slug: raw.slug || slugify(String(raw.name ?? "")) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (RESERVED_SLUGS.has(d.slug)) return { error: "That store address is reserved. Try another." };
  if (await getStoreBySlug(d.slug)) return { error: "That store address is already taken. Try another." };

  let storeId: string;
  try {
    const store = await createStoreRow({
      owner_id: user.id,
      name: d.name,
      slug: d.slug,
      tagline: d.tagline,
      theme: d.theme,
      primary_color: d.primary_color,
      hero_title: `Welcome to ${d.name}`,
      hero_subtitle: d.tagline || "Discover products you'll love.",
      about: `${d.name} is an online store powered by Farho.`,
    });
    storeId = store.id;
  } catch (e) {
    if (isConflict(e)) return { error: "That store address is already taken. Try another." };
    throw e;
  }
  redirect(`/dashboard/${storeId}?welcome=1`);
}

const bool = z.preprocess((v) => v === "on" || v === "1", z.boolean());

const designSchema = z.object({
  theme: z.enum(THEMES),
  font: z.enum(FONTS),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour."),
  tagline: z.string().trim().max(150),
  announcement: z.string().trim().max(200),
  about: z.string().trim().max(2000),
});

export async function updateDesign(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId, "manager");
  const parsed = designSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let logo: string;
  try {
    logo = await resolveImage(form, "logo_url", store.logo_url);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await updateStoreRow(store.id, { ...parsed.data, logo_url: logo });
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Brand saved. Your website has been updated." };
}

const money = z.coerce.number().min(0, "Amounts can't be negative.");

const socialUrl = z.union([
  z.literal(""),
  z.string().trim().max(200).regex(/^https?:\/\/\S+$/, "Social links must start with https://"),
]);

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(60),
  currency: z.enum(["NPR", "INR", "USD"]),
  delivery_charge: money,
  free_delivery_over: money,
  contact_phone: z.string().trim().max(40),
  contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid contact email.")]),
  address: z.string().trim().max(200),
  facebook_url: socialUrl,
  instagram_url: socialUrl,
  tiktok_url: socialUrl,
  published: bool,
});

export async function updateSettings(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId, "owner");
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await updateStoreRow(store.id, parsed.data);
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Settings saved." };
}

export async function deleteStore(storeId: string, form: FormData) {
  const { store } = await requireStore(storeId, "owner");
  if (String(form.get("confirm") ?? "").trim() !== store.slug) {
    redirect(`/dashboard/${store.id}/settings?error=confirm`);
  }
  await deleteStoreCascade(store.id);
  redirect("/dashboard");
}
