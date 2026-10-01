"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { ncmBranches, ncmCheckToken } from "@/lib/couriers/ncm";
import { pathaoStores, type PathaoCredentials } from "@/lib/couriers/pathao";
import { bookDelivery, getPathao, refreshCourierStatus } from "@/lib/couriers/service";
import { getOrder, setStoreSecret } from "@/lib/data";
import type { FormState } from "@/lib/types";

export async function connectPathao(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const existing = await getPathao(store.id);
  const creds: PathaoCredentials = {
    client_id: String(form.get("client_id") ?? "").trim() || existing?.client_id || "",
    client_secret: String(form.get("client_secret") ?? "").trim() || existing?.client_secret || "",
    username: String(form.get("username") ?? "").trim() || existing?.username || "",
    password: String(form.get("password") ?? "").trim() || existing?.password || "",
    sandbox: form.get("sandbox") === "on",
  };
  if (!creds.client_id || !creds.client_secret || !creds.username || !creds.password) return { error: "Fill in all four Pathao credentials." };
  try {
    const stores = await pathaoStores(creds);
    const chosen = Number(form.get("store_id")) || existing?.store_id;
    creds.store_id = stores.find((s) => s.store_id === chosen)?.store_id ?? stores[0]?.store_id;
    if (!creds.store_id) return { error: "Your Pathao account has no active pickup store. Add one in the Pathao merchant panel." };
  } catch (e) {
    return { error: (e as Error).message };
  }
  await setStoreSecret(store.id, "courier:pathao", creds);
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Pathao connected." };
}

export async function connectNcm(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const token = String(form.get("token") ?? "").trim();
  const pickup = String(form.get("pickup_branch") ?? "").trim();
  const sandbox = form.get("sandbox") === "on";
  if (!token || !pickup) return { error: "Enter your NCM API token and pickup branch." };
  const branches = await ncmBranches(sandbox).catch(() => []);
  if (branches.length && !branches.some((b) => b.name === pickup)) return { error: "Choose a pickup branch from the list." };
  try {
    await ncmCheckToken({ token, sandbox, pickup_branch: pickup });
  } catch (e) {
    return { error: (e as Error).message };
  }
  await setStoreSecret(store.id, "courier:ncm", { token, sandbox, pickup_branch: pickup });
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { ok: "Nepal Can Move connected." };
}

export async function disconnectCourier(storeId: string, courier: "pathao" | "ncm") {
  const { store } = await requireStore(storeId);
  await setStoreSecret(store.id, `courier:${courier}`, null);
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

const bookingSchema = z.object({
  courier: z.enum(["pathao", "ncm", "own"]),
  weight: z.coerce.number().min(0.1).max(50).default(0.5),
  instruction: z.string().trim().max(250).default(""),
  branch: z.string().trim().max(80).optional(),
  own_courier: z.string().trim().max(30).optional(),
  own_ref: z.string().trim().max(80).optional(),
});

export async function bookOrderDelivery(storeId: string, orderId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const order = await getOrder(store.id, orderId);
  if (!order) return { error: "Order not found." };
  if (order.status === "cancelled") return { error: "This order is cancelled." };
  if (order.courier_ref && order.courier !== "own") return { error: "Delivery is already booked for this order." };
  const parsed = bookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  try {
    const r = await bookDelivery(store, order, {
      courier: d.courier,
      weightKg: d.weight,
      instruction: d.instruction,
      branch: d.branch,
      ownCourier: d.own_courier,
      ownRef: d.own_ref,
    });
    revalidatePath(`/dashboard/${store.id}`, "layout");
    return { ok: r.ref ? `Booked! Tracking number ${r.ref}.` : "Marked as out for delivery." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function refreshDelivery(storeId: string, orderId: string) {
  const { store } = await requireStore(storeId);
  const order = await getOrder(store.id, orderId);
  if (order) await refreshCourierStatus(store, order).catch((e) => console.error(e));
  revalidatePath(`/dashboard/${store.id}`, "layout");
}
