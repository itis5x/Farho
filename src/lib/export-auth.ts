import "server-only";
import { getCurrentUser } from "./auth";
import { getStore } from "./data";

/** For download routes: the store, if the signed-in user owns it. */
export async function ownedStore(storeId: string) {
  const user = await getCurrentUser();
  if (!user || !/^[a-zA-Z0-9]{1,36}$/.test(storeId)) return null;
  const store = await getStore(storeId);
  return store && store.owner_id === user.id ? store : null;
}

export const csvResponse = (csv: string, name: string) =>
  new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
