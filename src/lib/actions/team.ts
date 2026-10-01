"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isConflict } from "@/lib/appwrite";
import { requireStore } from "@/lib/auth";
import { addStaff, getUserByEmail, listStaff, removeStaff, updateStaff } from "@/lib/data";
import type { FormState } from "@/lib/types";

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email."), role: z.enum(["manager", "staff"]) });

export async function inviteStaff(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store, user } = await requireStore(storeId, "owner");
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, role } = parsed.data;
  if (email === user.email.toLowerCase()) return { error: "That's you — you already own this store." };
  if ((await listStaff(store.id)).length >= 25) return { error: "A store can have up to 25 team members." };
  const existing = await getUserByEmail(email);
  try {
    await addStaff(store.id, email, role, existing?.id ?? null);
  } catch (e) {
    if (isConflict(e)) return { error: "This person is already on your team." };
    throw e;
  }
  revalidatePath(`/dashboard/${store.id}/team`);
  return {
    ok: existing
      ? `${email} now has access. They'll see ${store.name} when they log in.`
      : `Invitation saved. Ask ${email} to sign up at Farho with this email — they'll get access automatically.`,
  };
}

export async function changeStaffRole(storeId: string, memberId: string, form: FormData) {
  const { store } = await requireStore(storeId, "owner");
  const role = z.enum(["manager", "staff"]).parse(form.get("role"));
  if ((await listStaff(store.id)).some((m) => m.id === memberId)) await updateStaff(memberId, { role });
  revalidatePath(`/dashboard/${store.id}/team`);
}

export async function removeStaffMember(storeId: string, memberId: string) {
  const { store } = await requireStore(storeId, "owner");
  if ((await listStaff(store.id)).some((m) => m.id === memberId)) await removeStaff(memberId);
  revalidatePath(`/dashboard/${store.id}/team`);
}
