"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession } from "@/lib/auth";
import { createUser, getUserByEmail } from "@/lib/data";
import type { FormState } from "@/lib/types";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password } = parsed.data;

  if (await getUserByEmail(email)) return { error: "An account with this email already exists." };

  const user = await createUser({ name, email, password_hash: await bcrypt.hash(password, 10) });
  await createSession(user.id);
  redirect("/dashboard/new");
}

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = email ? await getUserByEmail(email) : null;
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: "Incorrect email or password." };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
