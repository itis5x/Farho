"use server";

import { revalidatePath } from "next/cache";
import { requireStore } from "@/lib/auth";
import { layoutSchema, parseLayout } from "@/lib/builder/schema";
import { getTemplate } from "@/lib/builder/templates";
import { updateStoreRow } from "@/lib/data";
import type { FormState } from "@/lib/types";
import { resolveImage } from "@/lib/uploads";

function refresh(store: { id: string; slug: string }) {
  revalidatePath(`/store/${store.slug}`, "layout");
  revalidatePath(`/dashboard/${store.id}/design`);
}

/** Saves the whole builder state (sections, pages, custom CSS). */
export async function saveLayout(storeId: string, json: string): Promise<FormState> {
  const { store } = await requireStore(storeId, "manager");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: "Couldn't read the layout." };
  }
  const parsed = layoutSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `${issue.path.join(" › ")}: ${issue.message}` };
  }
  const slugs = parsed.data.pages.map((p) => p.slug);
  if (new Set(slugs).size !== slugs.length) return { error: "Two pages have the same web address." };
  await updateStoreRow(store.id, { layout: JSON.stringify(parsed.data) });
  refresh(store);
  return { ok: "Published! Your website is updated." };
}

/** Replaces the homepage and look with a template (keeps products, pages and settings). */
export async function applyTemplate(storeId: string, templateId: string): Promise<FormState> {
  const { store } = await requireStore(storeId, "manager");
  const t = getTemplate(templateId);
  if (!t) return { error: "Template not found." };
  const current = parseLayout(store.layout, store);
  await updateStoreRow(store.id, {
    theme: t.theme,
    primary_color: t.primary_color,
    font: t.font,
    announcement: store.announcement || t.announcement,
    layout: JSON.stringify({ ...current, sections: t.sections(store.name), custom_css: t.custom_css ?? "", template: t.id }),
  });
  refresh(store);
  return { ok: `“${t.name}” applied. Edit any section to make it yours.` };
}

/** Uploads one image for the builder and returns its URL. */
export async function uploadBuilderImage(storeId: string, form: FormData): Promise<{ url?: string; error?: string }> {
  await requireStore(storeId);
  try {
    const url = await resolveImage(form, "image");
    return url ? { url } : { error: "Choose an image." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
