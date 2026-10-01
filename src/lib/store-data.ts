import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "./auth";
import { getStoreBySlug } from "./data";
import type { Store } from "./types";

/** Loads a storefront by slug. Unpublished stores are only visible to their owner. */
export const getStorefront = cache(async (slug: string): Promise<{ store: Store; isOwner: boolean; hidden: boolean }> => {
  const store = /^[a-z0-9-]{1,50}$/i.test(slug) ? await getStoreBySlug(slug) : null;
  if (!store) notFound();
  const user = await getCurrentUser();
  const isOwner = user?.id === store.owner_id;
  return { store, isOwner, hidden: !store.published && !isOwner };
});
