import "server-only";
import { canAccess, getCurrentUser, storeRole } from "./auth";

/** For download routes: the store, if the signed-in user is its owner or a manager. */
export async function ownedStore(storeId: string) {
  const user = await getCurrentUser();
  if (!user || !/^[a-zA-Z0-9]{1,36}$/.test(storeId)) return null;
  const access = await storeRole(storeId, user.id);
  return access && canAccess(access.role, "manager") ? access.store : null;
}

export const csvResponse = (csv: string, name: string) =>
  new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
