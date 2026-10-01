import "server-only";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { createRow, decrementColumn, incrementColumn } from "./appwrite";
import { TABLES } from "./appwrite-schema";
import { addOrderEvent, getCouponByCode, getProduct, getVariant, productOptions, upsertCustomer } from "./data";
import type { PaymentMethod } from "./payments/settings";
import type { Coupon, Order, Product, Store, Variant } from "./types";
import { notifyOrder } from "./sms";
import { formatMoney } from "./utils";

export type CartLine = { productId: string; variantId?: string; quantity: number };

export const ORDER_SOURCES = ["website", "chat", "messenger", "instagram", "whatsapp", "telegram", "manual", "pos"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export type PricedLine = { product: Product; variant: Variant | null; price: number; quantity: number };

export type Priced = {
  lines: PricedLine[];
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
  const [products, variants] = await Promise.all([
    Promise.all(cart.map((l) => getProduct(store.id, l.productId))),
    Promise.all(cart.map((l) => (l.variantId ? getVariant(l.variantId) : null))),
  ]);
  const lines: PricedLine[] = [];
  for (const [i, line] of cart.entries()) {
    const product = products[i];
    if (!product || !product.active) return { error: "One of the items in your cart is no longer available." };
    const hasVariants = productOptions(product).length > 0;
    const variant = variants[i];
    if (hasVariants && (!variant || variant.product_id !== product.id)) return { error: `Please choose options for “${product.name}”.` };
    const label = variant ? `${product.name} (${variant.title})` : product.name;
    const stock = variant ? variant.stock : product.stock;
    if (stock != null && stock < line.quantity) {
      return { error: stock === 0 ? `“${label}” is sold out.` : `Only ${stock} of “${label}” left in stock.` };
    }
    lines.push({ product, variant: hasVariants ? variant : null, price: variant?.price ?? product.price, quantity: line.quantity });
  }
  if (lines.length === 0) return { error: "Your cart is empty." };

  const subtotal = round(lines.reduce((s, l) => s + l.price * l.quantity, 0));
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
  /** Seller-entered extra discount (POS / manual orders). */
  extraDiscount?: number;
  /** Override the store's delivery charge (e.g. 0 for counter sales). */
  deliveryCharge?: number;
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
  if (input.extraDiscount || input.deliveryCharge != null) {
    priced.discount = Math.min(priced.subtotal, round(priced.discount + Math.max(0, input.extraDiscount ?? 0)));
    if (input.deliveryCharge != null) priced.delivery = Math.max(0, input.deliveryCharge);
    priced.total = round(priced.subtotal - priced.discount + priced.delivery);
  }

  const reserved: { table: string; id: string; qty: number }[] = [];
  const release = () =>
    Promise.all(reserved.map((r) => incrementColumn(r.table, r.id, "stock", r.qty).catch(() => undefined)));

  try {
    for (const { product, variant, quantity } of priced.lines) {
      const target = variant ? { table: TABLES.variants, id: variant.id, stock: variant.stock } : { table: TABLES.products, id: product.id, stock: product.stock };
      if (target.stock == null) continue;
      let left: number | null;
      try {
        left = (await decrementColumn<{ stock: number | null }>(target.table, target.id, "stock", quantity, 0)).stock;
      } catch {
        await release();
        return { error: `Sorry, “${product.name}” just sold out or doesn't have enough stock left.` };
      }
      reserved.push({ table: target.table, id: target.id, qty: quantity });
      // Keep the product's total in step with its variants.
      if (variant && product.stock != null) {
        await decrementColumn(TABLES.products, product.id, "stock", quantity).catch(() => undefined);
        reserved.push({ table: TABLES.products, id: product.id, qty: quantity });
      }
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
      ...priced.lines.map(({ product, variant, price, quantity }) =>
        createRow(TABLES.orderItems, {
          store_id: store.id,
          order_id: order.id,
          product_id: product.id,
          variant_id: variant?.id ?? "",
          variant_title: variant?.title ?? "",
          name: product.name,
          image_url: variant?.image_url || product.image_url,
          price,
          cost_price: product.cost_price ?? null,
          quantity,
        }),
      ),
      addOrderEvent(store.id, order.id, "status", input.event),
      priced.coupon ? incrementColumn(TABLES.coupons, priced.coupon.id, "times_used", 1) : null,
    ]);

    revalidatePath(`/store/${store.slug}`, "layout");
    revalidatePath(`/dashboard/${store.id}`, "layout");
    void notifyOrder(order, "placed", store);
    return { order, priced };
  } catch (e) {
    await release();
    throw e;
  }
}
