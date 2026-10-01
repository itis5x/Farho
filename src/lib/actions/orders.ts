"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type Coupon,
  type Order,
  type Product,
  type Store,
} from "@/lib/types";
import { formatMoney } from "@/lib/utils";

/* ----------------------------- Admin actions ----------------------------- */

function logEvent(orderId: number, kind: string, message: string) {
  db.prepare("INSERT INTO order_events (order_id, kind, message) VALUES (?, ?, ?)").run(orderId, kind, message);
}

function getOrder(storeId: number, orderId: number) {
  return db.prepare("SELECT * FROM orders WHERE id = ? AND store_id = ?").get(orderId, storeId) as Order | undefined;
}

/** Puts stock back (direction = 1) or takes it out again (direction = -1). */
function adjustStock(orderId: number, direction: 1 | -1) {
  const items = db
    .prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL")
    .all(orderId) as { product_id: number; quantity: number }[];
  const stmt = db.prepare(
    "UPDATE products SET stock = MAX(0, stock + ?) WHERE id = ? AND stock IS NOT NULL",
  );
  for (const it of items) stmt.run(direction * it.quantity, it.product_id);
}

export async function updateOrderStatus(storeId: number, orderId: number, form: FormData) {
  const { store } = await requireStore(storeId);
  const status = z.enum(ORDER_STATUSES).parse(form.get("status"));
  const order = getOrder(store.id, orderId);
  if (!order || order.status === status) return;

  db.transaction(() => {
    if (status === "cancelled") adjustStock(order.id, 1);
    if (order.status === "cancelled") adjustStock(order.id, -1);
    // Cash on delivery: delivered means the cash was collected.
    const markPaid = status === "delivered" && order.payment_method === "cod" && order.payment_status === "unpaid";
    db.prepare(
      `UPDATE orders SET status = ?, payment_status = CASE WHEN ? THEN 'paid' ELSE payment_status END,
         updated_at = datetime('now') WHERE id = ?`,
    ).run(status, markPaid ? 1 : 0, order.id);
    logEvent(order.id, "status", `Status changed from ${order.status} to ${status}`);
    if (markPaid) logEvent(order.id, "payment", "Cash collected on delivery — marked as paid");
  })();
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

export async function updatePaymentStatus(storeId: number, orderId: number, form: FormData) {
  const { store } = await requireStore(storeId);
  const status = z.enum(PAYMENT_STATUSES).parse(form.get("payment_status"));
  const order = getOrder(store.id, orderId);
  if (!order || order.payment_status === status) return;
  db.prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);
  logEvent(order.id, "payment", `Payment marked as ${status}`);
  revalidatePath(`/dashboard/${store.id}`, "layout");
}

export async function addOrderNote(storeId: number, orderId: number, form: FormData) {
  const { store } = await requireStore(storeId);
  const note = String(form.get("note") ?? "").trim().slice(0, 1000);
  const order = getOrder(store.id, orderId);
  if (!order || !note) return;
  logEvent(order.id, "note", note);
  revalidatePath(`/dashboard/${store.id}/orders/${order.id}`);
}

/* --------------------------- Storefront checkout -------------------------- */

export type CartLine = { productId: number; quantity: number };

type Priced = {
  lines: { product: Product; quantity: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: Coupon | null;
  couponError?: string;
};

function priceCart(store: Store, cart: CartLine[], couponCode: string): Priced | { error: string } {
  const lines: Priced["lines"] = [];
  for (const line of cart) {
    const product = db
      .prepare("SELECT * FROM products WHERE id = ? AND store_id = ? AND active = 1")
      .get(line.productId, store.id) as Product | undefined;
    if (!product) return { error: "One of the items in your cart is no longer available." };
    if (product.stock != null && product.stock < line.quantity) {
      return {
        error:
          product.stock === 0
            ? `“${product.name}” is sold out.`
            : `Only ${product.stock} of “${product.name}” left in stock.`,
      };
    }
    lines.push({ product, quantity: line.quantity });
  }
  if (lines.length === 0) return { error: "Your cart is empty." };

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);
  let discount = 0;
  let coupon: Coupon | null = null;
  let couponError: string | undefined;
  if (couponCode) {
    const c = db
      .prepare("SELECT * FROM coupons WHERE store_id = ? AND code = ? AND active = 1")
      .get(store.id, couponCode) as Coupon | undefined;
    if (!c) couponError = "That coupon code isn't valid.";
    else if (subtotal < c.min_subtotal)
      couponError = `This coupon needs a minimum order of ${formatMoney(c.min_subtotal, store.currency)}.`;
    else {
      coupon = c;
      discount = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
      discount = Math.min(subtotal, Math.round(discount * 100) / 100);
    }
  }
  const freeDelivery = store.free_delivery_over > 0 && subtotal - discount >= store.free_delivery_over;
  const delivery = freeDelivery ? 0 : store.delivery_charge;
  return { lines, subtotal, discount, delivery, total: subtotal - discount + delivery, coupon, couponError };
}

const cartSchema = z
  .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(99) }))
  .max(50);

function loadPublishedStore(slug: string) {
  return db.prepare("SELECT * FROM stores WHERE slug = ? AND published = 1").get(slug) as Store | undefined;
}

export async function quoteCart(storeSlug: string, rawCart: CartLine[], couponCode: string) {
  const store = loadPublishedStore(storeSlug);
  const cart = cartSchema.safeParse(rawCart);
  if (!store || !cart.success) return { error: "Store unavailable." };
  const priced = priceCart(store, cart.data, couponCode.trim());
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
  customer_name: z.string().trim().min(2, "Please enter your full name.").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,16}$/, "Please enter a valid phone number."),
  email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email.")]),
  city: z.string().trim().min(2, "Please enter your city.").max(60),
  address: z.string().trim().min(4, "Please enter your delivery address.").max(240),
  note: z.string().trim().max(500).default(""),
  coupon: z.string().trim().max(20).default(""),
});

export async function placeOrder(
  storeSlug: string,
  rawCart: CartLine[],
  form: FormData,
): Promise<{ error: string } | { token: string }> {
  const store = loadPublishedStore(storeSlug);
  if (!store) return { error: "This store isn't accepting orders right now." };
  const cart = cartSchema.safeParse(rawCart);
  if (!cart.success) return { error: "Your cart is invalid. Please refresh and try again." };
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  try {
    const token = db.transaction(() => {
      // Re-price inside the transaction so stock checks and decrements are atomic.
      const priced = priceCart(store, cart.data, d.coupon);
      if ("error" in priced) throw new CheckoutError(priced.error);
      if (d.coupon && priced.couponError) throw new CheckoutError(priced.couponError);

      const phone = d.phone.replace(/[\s-]/g, "");
      db.prepare(
        `INSERT INTO customers (store_id, name, phone, email, address, city) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (store_id, phone) DO UPDATE SET name = excluded.name, address = excluded.address,
           city = excluded.city, email = CASE WHEN excluded.email != '' THEN excluded.email ELSE customers.email END`,
      ).run(store.id, d.customer_name, phone, d.email, d.address, d.city);
      const customer = db
        .prepare("SELECT id FROM customers WHERE store_id = ? AND phone = ?")
        .get(store.id, phone) as { id: number };

      const { next_order_number: number } = db
        .prepare("UPDATE stores SET next_order_number = next_order_number + 1 WHERE id = ? RETURNING next_order_number - 1 AS next_order_number")
        .get(store.id) as { next_order_number: number };

      const publicToken = crypto.randomBytes(16).toString("hex");
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO orders (store_id, number, public_token, customer_id, customer_name, phone, email, address, city, note,
             subtotal, discount, coupon_code, delivery_charge, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          store.id,
          number,
          publicToken,
          customer.id,
          d.customer_name,
          phone,
          d.email,
          d.address,
          d.city,
          d.note,
          priced.subtotal,
          priced.discount,
          priced.coupon?.code ?? "",
          priced.delivery,
          priced.total,
        );
      const orderId = Number(lastInsertRowid);

      const insertItem = db.prepare(
        "INSERT INTO order_items (order_id, product_id, name, image_url, price, quantity) VALUES (?, ?, ?, ?, ?, ?)",
      );
      const takeStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL");
      for (const { product, quantity } of priced.lines) {
        insertItem.run(orderId, product.id, product.name, product.image_url, product.price, quantity);
        takeStock.run(quantity, product.id);
      }
      if (priced.coupon) db.prepare("UPDATE coupons SET times_used = times_used + 1 WHERE id = ?").run(priced.coupon.id);
      logEvent(orderId, "status", "Order placed by customer");
      return publicToken;
    })();

    revalidatePath(`/store/${store.slug}`, "layout");
    revalidatePath(`/dashboard/${store.id}`, "layout");
    return { token };
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    throw e;
  }
}

class CheckoutError extends Error {}
