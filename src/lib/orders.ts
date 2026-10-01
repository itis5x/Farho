import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createRow, decrementColumn, incrementColumn } from "./appwrite";
import { TABLES } from "./appwrite-schema";
import { addOrderEvent, getCouponByCode, getProduct, upsertCustomer } from "./data";
import type { PaymentMethod } from "./payments/settings";
import type { Coupon, Order, Product, Store } from "./types";
import { formatMoney } from "./utils";

export type CartLine = { productId: string; quantity: number };

export const ORDER_SOURCES = ["website", "chat", "messenger", "instagram", "whatsapp", "telegram", "manual", "pos"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export type Priced = {
  lines: { product: Product; quantity: number }[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
  coupon: Coupon | null;
  couponError?: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Prices a cart from the database (never trusting client prices) and checks stock. */
export async function priceCart(store: Store, cart: CartLine[], couponCode: string): Promise<Priced | { error: string }> {
  const products = await Promise.all(cart.map((l) => getProduct(store.id, l.productId)));
  const lines: Priced["lines"] = [];
  for (const [i, line] of cart.entries()) {
    const product = products[i];
    if (!product || !product.active) return { error: "One of the items in your cart is no longer available." };
    if (product.stock != null && product.stock < line.quantity) {
      return {
        error: product.stock === 0 ? `“${product.name}” is sold out.` : `Only ${product.stock} of “${product.name}” left in stock.`,
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
    else if (subtotal < c.min_subtotal) couponError = `This coupon needs a minimum order of ${formatMoney(c.min_subtotal, store.currency)}.`;
    else {
      coupon = c;
      discount = Math.min(subtotal, round(c.kind === "percent" ? (subtotal * c.value) / 100 : c.value));
    }
  }
  const freeDelivery = store.free_delivery_over > 0 && subtotal - discount >= store.free_delivery_over;
  const delivery = freeDelivery ? 0 : store.delivery_charge;
  return { lines, subtotal, discount, delivery, total: round(subtotal - discount + delivery), coupon, couponError };
}

export type NewOrder = {
  store: Store;
  cart: CartLine[];
  customer: { name: string; phone: string; email: string; address: string; city: string };
  note?: string;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  paymentProofUrl?: string;
  source: OrderSource;
  /** First timeline entry, e.g. "Order placed by customer". */
  event: string;
};

/**
 * Creates an order. Stock is reserved with atomic decrements and released again if any later step fails,
 * so two customers can never buy the last item at the same time.
 */
export async function createOrder(input: NewOrder): Promise<{ order: Order; priced: Priced } | { error: string }> {
  const { store } = input;
  const priced = await priceCart(store, input.cart, input.couponCode ?? "");
  if ("error" in priced) return priced;
  if (input.couponCode && priced.couponError) return { error: priced.couponError };

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
        await release();
        return { error: `Sorry, “${product.name}” just sold out or doesn't have enough stock left.` };
      }
      reserved.push({ id: product.id, qty: quantity });
      if (left != null && left < 0) {
        await release();
        return { error: `Sorry, “${product.name}” just sold out or doesn't have enough stock left.` };
      }
    }

    const phone = input.customer.phone.replace(/[\s-]/g, "");
    const [customer, storeRow] = await Promise.all([
      upsertCustomer(store.id, { ...input.customer, phone }),
      incrementColumn<Store>(TABLES.stores, store.id, "next_order_number", 1),
    ]);
    const order = await createRow<Order>(TABLES.orders, {
      store_id: store.id,
      number: storeRow.next_order_number - 1,
      public_token: crypto.randomBytes(16).toString("hex"),
      customer_id: customer.id,
      customer_name: input.customer.name,
      phone,
      email: input.customer.email,
      address: input.customer.address,
      city: input.customer.city,
      note: input.note ?? "",
      subtotal: priced.subtotal,
      discount: priced.discount,
      coupon_code: priced.coupon?.code ?? "",
      delivery_charge: priced.delivery,
      total: priced.total,
      payment_method: input.paymentMethod,
      payment_ref: input.paymentRef ?? "",
      payment_proof_url: input.paymentProofUrl ?? "",
      source: input.source,
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
      addOrderEvent(store.id, order.id, "status", input.event),
      priced.coupon ? incrementColumn(TABLES.coupons, priced.coupon.id, "times_used", 1) : null,
    ]);

    revalidatePath(`/store/${store.slug}`, "layout");
    revalidatePath(`/dashboard/${store.id}`, "layout");
    return { order, priced };
  } catch (e) {
    await release();
    throw e;
  }
}
