"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStore, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
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
  if (db.prepare("SELECT 1 FROM stores WHERE slug = ?").get(d.slug)) {
    return { error: "That store address is already taken. Try another." };
  }

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO stores (owner_id, name, slug, tagline, theme, primary_color, hero_title, hero_subtitle, about)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      d.name,
      d.slug,
      d.tagline,
      d.theme,
      d.primary_color,
      `Welcome to ${d.name}`,
      d.tagline || "Discover products you'll love.",
      `${d.name} is an online store powered by Farho.`,
    );
  redirect(`/dashboard/${lastInsertRowid}?welcome=1`);
}

const bool = z.preprocess((v) => (v === "on" || v === "1" ? 1 : 0), z.number());

const designSchema = z.object({
  theme: z.enum(THEMES),
  font: z.enum(FONTS),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid colour."),
  tagline: z.string().trim().max(120),
  hero_title: z.string().trim().max(120),
  hero_subtitle: z.string().trim().max(240),
  announcement: z.string().trim().max(160),
  about: z.string().trim().max(2000),
  show_categories: bool,
  show_featured: bool,
  show_about: bool,
});

export async function updateDesign(storeId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = designSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let logo: string, hero: string;
  try {
    logo = await resolveImage(form, "logo_url", store.logo_url);
    hero = await resolveImage(form, "hero_image_url", store.hero_image_url);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const d = parsed.data;
  db.prepare(
    `UPDATE stores SET theme=?, font=?, primary_color=?, tagline=?, hero_title=?, hero_subtitle=?, announcement=?,
       about=?, show_categories=?, show_featured=?, show_about=?, logo_url=?, hero_image_url=? WHERE id=?`,
  ).run(
    d.theme,
    d.font,
    d.primary_color,
    d.tagline,
    d.hero_title,
    d.hero_subtitle,
    d.announcement,
    d.about,
    d.show_categories,
    d.show_featured,
    d.show_about,
    logo,
    hero,
    store.id,
  );
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Design saved. Your website has been updated." };
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

export async function updateSettings(storeId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  db.prepare(
    `UPDATE stores SET name=?, currency=?, delivery_charge=?, free_delivery_over=?, contact_phone=?, contact_email=?,
       address=?, facebook_url=?, instagram_url=?, tiktok_url=?, published=? WHERE id=?`,
  ).run(
    d.name,
    d.currency,
    d.delivery_charge,
    d.free_delivery_over,
    d.contact_phone,
    d.contact_email,
    d.address,
    d.facebook_url,
    d.instagram_url,
    d.tiktok_url,
    d.published,
    store.id,
  );
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Settings saved." };
}

export async function deleteStore(storeId: number, form: FormData) {
  const { store } = await requireStore(storeId);
  if (String(form.get("confirm") ?? "").trim() !== store.slug) {
    redirect(`/dashboard/${store.id}/settings?error=confirm`);
  }
  db.prepare("DELETE FROM stores WHERE id = ?").run(store.id);
  redirect("/dashboard");
}
