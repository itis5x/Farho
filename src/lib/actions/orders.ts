"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decrementColumn, getRow, incrementColumn, isNotFound, updateRow } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { requireStore } from "@/lib/auth";
import { addOrderEvent, getOrder, getOrderByToken, getStoreBySlug, listOrderItems, updateOrderRow } from "@/lib/data";
import { createOrder, priceCart, type CartLine } from "@/lib/orders";
import { availableMethods, startOnlinePayment, type PaymentStart } from "@/lib/payments/service";
import { MANUAL_METHODS, ONLINE_METHODS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/settings";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/types";
import { notifyOrder } from "@/lib/sms";
import { resolveImage } from "@/lib/uploads";

/* ----------------------------- Admin actions ----------------------------- */

/** Adds stock back (direction = 1) or takes it out again (direction = -1) for an order's items. */
async function adjustStock(orderId: string, direction: 1 | -1) {
  const items = await listOrderItems([orderId]);
  await Promise.all(
    items
      .filter((it) => it.product_id)
      .map(async (it) => {
        const table = it.variant_id ? TABLES.variants : TABLES.products;
        const id = it.variant_id || it.product_id;
        try {
          const row = await getRow<{ id: string; stock: number | null }>(table, id);
          if (!row || row.stock == null) return;
          const updated =
            direction === 1
              ? await incrementColumn<{ stock: number | null }>(table, id, "stock", it.quantity)
              : await decrementColumn<{ stock: number | null }>(table, id, "stock", it.quantity);
          if (updated.stock != null && updated.stock < 0) await updateRow(table, id, { stock: 0 });
          if (it.variant_id) {
            const product = await getRow<{ stock: number | null }>(TABLES.products, it.product_id);
            if (product?.stock != null) {
              const p = direction === 1
                ? await incrementColumn<{ stock: number | null }>(TABLES.products, it.product_id, "stock", it.quantity)
                : await decrementColumn<{ stock: number | null }>(TABLES.products, it.product_id, "stock", it.quantity);
              if (p.stock != null && p.stock < 0) await updateRow(TABLES.products, it.product_id, { stock: 0 });
            }
          }
        } catch (e) {
          if (!isNotFound(e)) throw e;
        }
      }),
  );
}

export async function updateOrderStatus(storeId: string, orderId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const status = z.enum(ORDER_STATUSES).parse(form.get("status"));
  const order = await getOrder(store.id, orderId);
  if (!order || order.status === status) return;

  if (status === "cancelled") await adjustStock(order.id, 1);
  if (order.status === "cancelled") await adjustStock(order.id, -1);
  // Cash on delivery: delivered means the cash was collected.
  const markPaid = status === "delivered" && order.payment_method === "cod" && order.payment_status === "unpaid";
  await updateOrderRow(order.id, { status, ...(markPaid ? { payment_status: "paid" as const } : {}) });
  await addOrderEvent(store.id, order.id, "status", `Status changed from ${order.status} to ${status}`);
  if (markPaid) await addOrderEvent(store.id, order.id, "payment", "Cash collected on delivery — marked as paid");
  if (status === "shipped" || status === "delivered") void notifyOrder({ ...order, status }, status, store);
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

export async function updatePaymentStatus(storeId: string, orderId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const status = z.enum(PAYMENT_STATUSES).parse(form.get("payment_status"));
  const order = await getOrder(store.id, orderId);
  if (!order || order.payment_status === status) return;
  await updateOrderRow(order.id, { payment_status: status });
  await addOrderEvent(store.id, order.id, "payment", `Payment marked as ${status}`);
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

export async function addOrderNote(storeId: string, orderId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  const order = await getOrder(store.id, orderId);
  if (!order || !note) return;
  await addOrderEvent(store.id, order.id, "note", note);
  revalidatePath(`/dashboard/${store.id}/orders/${order.id}`);
}

/* --------------------------- Storefront checkout -------------------------- */

export type { CartLine } from "@/lib/orders";
const cartSchema = z
  .array(
    z.object({
      productId: z.string().regex(/^[a-zA-Z0-9._-]{1,36}$/),
      variantId: z.string().regex(/^[a-zA-Z0-9._-]{1,36}$/).optional(),
      quantity: z.number().int().min(1).max(99),
    }),
  )
  .max(30)
  .refine((lines) => new Set(lines.map((l) => `${l.productId}:${l.variantId ?? ""}`)).size === lines.length, "Duplicate cart lines.");

async function loadPublishedStore(slug: string) {
  const store = await getStoreBySlug(slug);
  return store?.published ? store : null;
}

export async function quoteCart(storeSlug: string, rawCart: CartLine[], couponCode: string) {
  const store = await loadPublishedStore(storeSlug);
  const cart = cartSchema.safeParse(rawCart);
  if (!store || !cart.success) return { error: "Store unavailable." };
  const priced = await priceCart(store, cart.data, couponCode.trim());
  if ("error" in priced) return { error: priced.error };
  return {
    subtotal: priced.subtotal,
    discount: priced.discount,
    delivery: priced.delivery,
    total: priced.total,
    couponApplied: priced.coupon?.code ?? null,
    couponError: priced.couponError ?? null,
  };
}

const checkoutSchema = z.object({
  customer_name: z.string().trim().min(2, "Please enter your full name.").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,16}$/, "Please enter a valid phone number."),
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email.").max(200)]),
  city: z.string().trim().min(2, "Please enter your city.").max(80),
  address: z.string().trim().min(4, "Please enter your delivery address.").max(250),
  note: z.string().trim().max(500).default(""),
  coupon: z.string().trim().max(20).default(""),
  payment_method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]).default("cod"),
  payment_ref: z.string().trim().max(120).default(""),
});

export async function placeOrder(
  storeSlug: string,
  rawCart: CartLine[],
  form: FormData,
): Promise<{ error: string } | { token: string; payment?: PaymentStart }> {
  const store = await loadPublishedStore(storeSlug);
  if (!store) return { error: "This store isn't accepting orders right now." };
  const cart = cartSchema.safeParse(rawCart);
  if (!cart.success) return { error: "Your cart is invalid. Please refresh and try again." };
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const methods = await availableMethods(store);
  if (!methods.includes(d.payment_method)) return { error: "Please choose a payment method." };
  const manual = MANUAL_METHODS.includes(d.payment_method);
  if (manual && !d.payment_ref) return { error: "Please enter the transaction ID / reference of your payment." };
  let proofUrl = "";
  if (manual) {
    try {
      proofUrl = await resolveImage(form, "payment_proof");
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  const result = await createOrder({
    store,
    cart: cart.data,
    customer: { name: d.customer_name, phone: d.phone, email: d.email, address: d.address, city: d.city },
    note: d.note,
    couponCode: d.coupon,
    paymentMethod: d.payment_method,
    paymentRef: manual ? d.payment_ref : "",
    paymentProofUrl: proofUrl,
    source: "website",
    event: manual
      ? `Order placed — customer says they paid by ${d.payment_method === "qr" ? "QR" : "bank transfer"} (ref ${d.payment_ref}). Please verify.`
      : "Order placed by customer",
  });
  if ("error" in result) return { error: result.error };
  if (ONLINE_METHODS.includes(d.payment_method)) {
    return { token: result.order.public_token, payment: await startOnlinePayment(store, result.order) };
  }
  return { token: result.order.public_token };
}

/** Starts (or retries) an online payment for an unpaid order from the customer's order page. */
export async function payOrder(storeSlug: string, token: string): Promise<PaymentStart> {
  const store = await loadPublishedStore(storeSlug);
  const order = store ? await getOrderByToken(store.id, token) : null;
  if (!store || !order) return { type: "error", message: "Order not found." };
  if (order.payment_status === "paid") return { type: "error", message: "This order is already paid." };
  if (order.status === "cancelled") return { type: "error", message: "This order was cancelled." };
  return startOnlinePayment(store, order);
}
