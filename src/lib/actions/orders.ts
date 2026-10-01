"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createRow, decrementColumn, getRow, incrementColumn, isNotFound, updateRow } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { requireStore } from "@/lib/auth";
import {
  addOrderEvent,
  getCouponByCode,
  getOrder,
  getProduct,
  getStoreBySlug,
  listOrderItems,
  updateOrderRow,
  upsertCustomer,
} from "@/lib/data";
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

/** Adds stock back (direction = 1) or takes it out again (direction = -1) for an order's items. */
async function adjustStock(orderId: string, direction: 1 | -1) {
  const items = await listOrderItems([orderId]);
  await Promise.all(
    items
      .filter((it) => it.product_id)
      .map(async (it) => {
        try {
          const p = await getRow<Product>(TABLES.products, it.product_id);
          if (!p || p.stock == null) return;
          const updated =
            direction === 1
              ? await incrementColumn<Product>(TABLES.products, p.id, "stock", it.quantity)
              : await decrementColumn<Product>(TABLES.products, p.id, "stock", it.quantity);
          if (updated.stock != null && updated.stock < 0) await updateRow(TABLES.products, p.id, { stock: 0 });
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

export type CartLine = { productId: string; quantity: number };

type Priced = {
  lines: { product: Product; quantity: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: Coupon | null;
  couponError?: string;
};

async function priceCart(store: Store, cart: CartLine[], couponCode: string): Promise<Priced | { error: string }> {
  const products = await Promise.all(cart.map((l) => getProduct(store.id, l.productId)));
  const lines: Priced["lines"] = [];
  for (const [i, line] of cart.entries()) {
    const product = products[i];
    if (!product || !product.active) return { error: "One of the items in your cart is no longer available." };
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

  const subtotal = round(lines.reduce((s, l) => s + l.product.price * l.quantity, 0));
  let discount = 0;
  let coupon: Coupon | null = null;
  let couponError: string | undefined;
  if (couponCode) {
    const c = await getCouponByCode(store.id, couponCode);
    if (!c || !c.active) couponError = "That coupon code isn't valid.";
    else if (subtotal < c.min_subtotal)
      couponError = `This coupon needs a minimum order of ${formatMoney(c.min_subtotal, store.currency)}.`;
    else {
      coupon = c;
      discount = c.kind === "percent" ? (subtotal * c.value) / 100 : c.value;
      discount = Math.min(subtotal, round(discount));
    }
  }
  const freeDelivery = store.free_delivery_over > 0 && subtotal - discount >= store.free_delivery_over;
  const delivery = freeDelivery ? 0 : store.delivery_charge;
  return { lines, subtotal, discount, delivery, total: round(subtotal - discount + delivery), coupon, couponError };
}

const round = (n: number) => Math.round(n * 100) / 100;

const cartSchema = z
  .array(z.object({ productId: z.string().regex(/^[a-zA-Z0-9._-]{1,36}$/), quantity: z.number().int().min(1).max(99) }))
  .max(30)
  .refine((lines) => new Set(lines.map((l) => l.productId)).size === lines.length, "Duplicate cart lines.");

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
});

export async function placeOrder(
  storeSlug: string,
  rawCart: CartLine[],
  form: FormData,
): Promise<{ error: string } | { token: string }> {
  const store = await loadPublishedStore(storeSlug);
  if (!store) return { error: "This store isn't accepting orders right now." };
  const cart = cartSchema.safeParse(rawCart);
  if (!cart.success) return { error: "Your cart is invalid. Please refresh and try again." };
  const parsed = checkoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const priced = await priceCart(store, cart.data, d.coupon);
  if ("error" in priced) return { error: priced.error };
  if (d.coupon && priced.couponError) return { error: priced.couponError };

  // Reserve stock with atomic decrements; undo everything if any step fails.
  const reserved: { id: string; qty: number }[] = [];
  const release = () =>
    Promise.all(reserved.map((r) => incrementColumn(TABLES.products, r.id, "stock", r.qty).catch(() => undefined)));

  try {
    for (const { product, quantity } of priced.lines) {
      if (product.stock == null) continue;
      let left: number | null;
      try {
        left = (await decrementColumn<Product>(TABLES.products, product.id, "stock", quantity, 0)).stock;
      } catch {
        left = -1;
      }
      if (left === -1 || (left != null && left < 0)) {
        if (left != null && left < 0) reserved.push({ id: product.id, qty: quantity });
        await release();
        return { error: `Sorry, “${product.name}” just sold out or doesn't have enough stock left.` };
      }
      reserved.push({ id: product.id, qty: quantity });
    }

    const phone = d.phone.replace(/[\s-]/g, "");
    const [customer, storeRow] = await Promise.all([
      upsertCustomer(store.id, { name: d.customer_name, phone, email: d.email, address: d.address, city: d.city }),
      incrementColumn<Store>(TABLES.stores, store.id, "next_order_number", 1),
    ]);
    const publicToken = crypto.randomBytes(16).toString("hex");
    const order = await createRow<Order>(TABLES.orders, {
      store_id: store.id,
      number: storeRow.next_order_number - 1,
      public_token: publicToken,
      customer_id: customer.id,
      customer_name: d.customer_name,
      phone,
      email: d.email,
      address: d.address,
      city: d.city,
      note: d.note,
      subtotal: priced.subtotal,
      discount: priced.discount,
      coupon_code: priced.coupon?.code ?? "",
      delivery_charge: priced.delivery,
      total: priced.total,
      created_at: new Date().toISOString(),
    });

    await Promise.all([
      ...priced.lines.map(({ product, quantity }) =>
        createRow(TABLES.orderItems, {
          store_id: store.id,
          order_id: order.id,
          product_id: product.id,
          name: product.name,
          image_url: product.image_url,
          price: product.price,
          quantity,
        }),
      ),
      addOrderEvent(store.id, order.id, "status", "Order placed by customer"),
      priced.coupon ? incrementColumn(TABLES.coupons, priced.coupon.id, "times_used", 1) : null,
    ]);

    revalidatePath(`/store/${store.slug}`, "layout");
    revalidatePath(`/dashboard/${store.id}`, "layout");
    return { token: publicToken };
  } catch (e) {
    await release();
    throw e;
  }
}
