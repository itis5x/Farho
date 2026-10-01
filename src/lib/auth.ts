import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionRow, deleteSessionByToken, getSessionByToken, getStore, getUser, staffInvitesForEmail, staffMembership, updateStaff } from "./data";
import type { StaffRole, Store, User } from "./types";

const SESSION_COOKIE = "farho_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await createSessionRow(token, userId, expires);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await deleteSessionByToken(token);
  jar.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await getSessionByToken(token);
  if (!session || new Date(session.expires_at) < new Date()) return null;
  return getUser(session.user_id);
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

const RANK: Record<StaffRole, number> = { staff: 1, manager: 2, owner: 3 };

/** The signed-in user's role in a store, or null if they have no access. */
export const storeRole = cache(async (storeId: string, userId: string): Promise<{ store: Store; role: StaffRole } | null> => {
  const store = /^[a-zA-Z0-9._-]{1,36}$/.test(storeId) ? await getStore(storeId) : null;
  if (!store) return null;
  if (store.owner_id === userId) return { store, role: "owner" };
  const membership = await staffMembership(store.id, userId);
  return membership ? { store, role: membership.role } : null;
});

/**
 * Loads a store the signed-in user can work on. Owners can do everything; managers everything except payments,
 * staff and deleting the store; staff handle orders, POS, inbox, products and customers.
 */
export async function requireStore(storeId: string, minRole: StaffRole = "staff"): Promise<{ user: User; store: Store; role: StaffRole }> {
  const user = await requireUser();
  const access = await storeRole(storeId, user.id);
  if (!access) redirect("/dashboard");
  if (RANK[access.role] < RANK[minRole]) redirect(`/dashboard/${access.store.id}?denied=1`);
  return { user, store: access.store, role: access.role };
}

export const canAccess = (role: StaffRole, min: StaffRole) => RANK[role] >= RANK[min];

/** Links pending staff invitations to a user once they sign up or log in with the invited email. */
export async function claimInvites(user: { id: string; email: string }) {
  const invites = await staffInvitesForEmail(user.email);
  await Promise.all(invites.map((i) => updateStaff(i.id, { user_id: user.id })));
}
