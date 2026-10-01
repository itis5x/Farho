import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "./auth";
import { db } from "./db";
import type { Store } from "./types";

/** Loads a storefront by slug. Unpublished stores are only visible to their owner. */
export const getStorefront = cache(async (slug: string): Promise<{ store: Store; isOwner: boolean; hidden: boolean }> => {
  const store = db.prepare("SELECT * FROM stores WHERE slug = ?").get(slug) as Store | undefined;
  if (!store) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === store.owner_id;
  return { store, isOwner, hidden: !store.published && !isOwner };
});
