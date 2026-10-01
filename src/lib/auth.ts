import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSessionRow, deleteSessionByToken, getSessionByToken, getStore, getUser } from "./data";
import type { Store, User } from "./types";

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

/** Loads a store and ensures the signed-in user owns it. */
export const requireStore = cache(async (storeId: string): Promise<{ user: User; store: Store }> => {
  const user = await requireUser();
  const store = /^[a-zA-Z0-9._-]{1,36}$/.test(storeId) ? await getStore(storeId) : null;
  if (!store || store.owner_id !== user.id) redirect("/dashboard");
  return { user, store };
});
