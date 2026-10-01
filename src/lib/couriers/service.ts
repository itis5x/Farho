import "server-only";
import crypto from "node:crypto";
import { addOrderEvent, getStoreSecret, listOrderItems, setStoreSecret, updateOrderRow } from "@/lib/data";
import type { Order, Store } from "@/lib/types";
import { notifyOrder } from "@/lib/sms";
import { formatMoney } from "@/lib/utils";
import { ncmCreateOrder, ncmStatus, type NcmCredentials } from "./ncm";
import { pathaoCreateOrder, pathaoStatus, type PathaoCredentials } from "./pathao";

export type CourierId = "pathao" | "ncm" | "own";
export { COURIER_LABELS } from "./labels";
import { COURIER_LABELS } from "./labels";

export const getPathao = (storeId: string) => getStoreSecret<PathaoCredentials>(storeId, "courier:pathao");
export const getNcm = (storeId: string) => getStoreSecret<NcmCredentials>(storeId, "courier:ncm");

/** Secret path segment for courier status webhooks. */
export async function courierWebhookSecret(storeId: string) {
  const existing = await getStoreSecret<{ secret: string }>(storeId, "courier:webhook");
  if (existing) return existing.secret;
  const secret = crypto.randomBytes(18).toString("hex");
  await setStoreSecret(storeId, "courier:webhook", { secret });
  return secret;
}

const DELIVERED = /^(delivered|delivery completed|completed)$/i;
const RETURNED = /(return|cancel)/i;

/** Applies a courier status update to an order (from a refresh or a webhook). */
export async function applyCourierStatus(order: Order, status: string) {
  if (!status || status === order.courier_status) return;
  await updateOrderRow(order.id, { courier_status: status.slice(0, 80) });
  await addOrderEvent(order.store_id, order.id, "courier", `${COURIER_LABELS[order.courier] ?? order.courier}: ${status}`);
  if (DELIVERED.test(status.trim()) && order.status !== "delivered") {
    const cod = order.payment_method === "cod" && order.payment_status === "unpaid";
    await updateOrderRow(order.id, { status: "delivered", ...(cod ? { payment_status: "paid" as const } : {}) });
    await addOrderEvent(order.store_id, order.id, "status", "Marked delivered by the courier");
    void notifyOrder({ ...order, status: "delivered" }, "delivered");
  } else if (!RETURNED.test(status) && ["pending", "confirmed", "processing"].includes(order.status) && /(picked|transit|hub|out for|dispatch|sent)/i.test(status)) {
    await updateOrderRow(order.id, { status: "shipped" });
    await addOrderEvent(order.store_id, order.id, "status", "Marked shipped — courier has the parcel");
    void notifyOrder({ ...order, status: "shipped" }, "shipped");
  }
}

export type BookingInput = { courier: CourierId; weightKg: number; instruction: string; branch?: string; ownCourier?: string; ownRef?: string };

export async function bookDelivery(store: Store, order: Order, input: BookingInput) {
  const items = await listOrderItems([order.id]);
  const quantity = items.reduce((s, i) => s + i.quantity, 0) || 1;
  const description = items.map((i) => `${i.quantity}× ${i.name}`).join(", ");
  const cod = order.payment_status === "paid" ? 0 : order.total;
  const address = [order.address, order.city].filter(Boolean).join(", ");
  const ref = `${store.slug}-${order.number}`;

  let result: { ref: string; status: string; fee?: number | null };
  if (input.courier === "pathao") {
    const creds = await getPathao(store.id);
    if (!creds) throw new Error("Connect Pathao in Delivery settings first.");
    result = await pathaoCreateOrder(creds, {
      ref, name: order.customer_name, phone: order.phone, address, cod, quantity,
      weightKg: input.weightKg, description, instruction: input.instruction,
    });
  } else if (input.courier === "ncm") {
    const creds = await getNcm(store.id);
    if (!creds) throw new Error("Connect Nepal Can Move in Delivery settings first.");
    if (!input.branch) throw new Error("Choose the NCM branch that delivers to this customer.");
    result = await ncmCreateOrder(creds, {
      ref, name: order.customer_name, phone: order.phone, address, cod, branch: input.branch,
      packageName: description, instruction: input.instruction, weightKg: input.weightKg,
    });
  } else {
    result = { ref: input.ownRef ?? "", status: "Out for delivery" };
  }

  const courierName = input.courier === "own" ? input.ownCourier || "own" : input.courier;
  await updateOrderRow(order.id, {
    courier: courierName,
    courier_ref: result.ref,
    courier_status: result.status,
    courier_fee: result.fee ?? null,
    courier_booked_at: new Date().toISOString(),
    ...(["pending", "confirmed"].includes(order.status) ? { status: input.courier === "own" ? "shipped" : "processing" } : {}),
  } as Partial<Order>);
  await addOrderEvent(
    store.id,
    order.id,
    "courier",
    `Delivery booked with ${COURIER_LABELS[input.courier] ?? courierName}${result.ref ? ` (tracking ${result.ref})` : ""}${cod ? ` — collect ${formatMoney(cod, store.currency)} on delivery` : ""}`,
  );
  return result;
}

export async function refreshCourierStatus(store: Store, order: Order) {
  if (!order.courier_ref) return null;
  let status: string | null = null;
  if (order.courier === "pathao") {
    const creds = await getPathao(store.id);
    if (creds) status = await pathaoStatus(creds, order.courier_ref);
  } else if (order.courier === "ncm") {
    const creds = await getNcm(store.id);
    if (creds) status = await ncmStatus(creds, order.courier_ref);
  }
  if (status) await applyCourierStatus(order, status);
  return status;
}
