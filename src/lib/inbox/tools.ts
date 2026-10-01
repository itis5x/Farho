import "server-only";

import { findOrderByNumber, listCategories, listProducts } from "@/lib/data";
import { createOrder, type OrderSource } from "@/lib/orders";
import { availableMethods } from "@/lib/payments/service";
import { METHOD_LABELS, ONLINE_METHODS, type PaymentMethod } from "@/lib/payments/settings";
import type { Conversation, Product, Store } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { updateConversation } from "./data";


const STOP = new Set(["the", "and", "for", "with", "price", "how", "much", "kati", "ho", "cha", "xa", "please", "plz", "want", "need", "have", "you", "your", "what", "is", "a", "an", "of", "to", "do", "k", "ko", "ma"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

export type ProductHit = { product: Product; score: number };

/** Simple keyword search over a store's active products (name counts most, then category, then description). */
export async function searchProducts(store: Store, query: string, limit = 5): Promise<ProductHit[]> {
  const [products, categories] = await Promise.all([listProducts(store.id, { activeOnly: true }), listCategories(store.id)]);
  const catName = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  const q = words(query);
  if (!q.length) return [];
  return products
    .map((p) => {
      const name = p.name.toLowerCase();
      const cat = catName.get(p.category_id) ?? "";
      const desc = p.description.toLowerCase();
      let score = 0;
      for (const w of q) {
        const stem = w.replace(/s$/, "");
        if (name.includes(stem)) score += 3;
        else if (cat.includes(stem)) score += 2;
        else if (desc.includes(stem)) score += 1;
      }
      return { product: p, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function productLine(store: Store, p: Product, origin: string) {
  const stock = p.stock === 0 ? " (sold out)" : p.stock != null && p.stock <= 5 ? ` (only ${p.stock} left)` : "";
  return `${p.name} — ${formatMoney(p.price, store.currency)}${stock}\n${origin}/store/${store.slug}/p/${p.slug}`;
}

const digits = (s: string) => s.replace(/\D/g, "").slice(-10);

/**
 * Order status for chat. Order numbers are sequential and easy to guess, so the tracking link (which shows the
 * customer's address) is only shared when the phone number on the order is given too.
 */
export async function orderStatusText(store: Store, number: number, origin: string, phone?: string) {
  const order = await findOrderByNumber(store.id, number);
  if (!order) return null;
  const pay = order.payment_status === "paid" ? "paid" : "not paid yet";
  const verified = !!phone && digits(phone).length >= 7 && digits(phone) === digits(order.phone);
  if (!verified) {
    return {
      order,
      verified,
      text: `Order #${order.number} is ${order.status}. For full details and the tracking link, please send the phone number used for this order.`,
    };
  }
  return {
    order,
    verified,
    text: `Order #${order.number} is ${order.status} (${pay}). Total ${formatMoney(order.total, store.currency)}.\nTrack it here: ${origin}/store/${store.slug}/order/${order.public_token}`,
  };
}

export type ChatOrderInput = {
  customer_name: string;
  phone: string;
  address: string;
  city: string;
  items: { product_id: string; variant_id?: string; quantity: number }[];
  payment_method: PaymentMethod;
  note?: string;
};

/** Places an order on behalf of a customer chatting with the store. */
export async function placeChatOrder(store: Store, conv: Conversation, input: ChatOrderInput, origin: string) {
  const methods = await availableMethods(store);
  const method = methods.includes(input.payment_method) ? input.payment_method : methods.includes("cod") ? "cod" : methods[0];
  const source: OrderSource = conv.kind === "web" ? "chat" : conv.kind;
  const result = await createOrder({
    store,
    cart: input.items.map((i) => ({ productId: i.product_id, ...(i.variant_id ? { variantId: i.variant_id } : {}), quantity: i.quantity })),
    customer: { name: input.customer_name, phone: input.phone, email: "", address: input.address, city: input.city },
    note: input.note,
    paymentMethod: method,
    source,
    event: `Order placed through ${source === "chat" ? "website chat" : source} by the Farho assistant`,
  });
  if ("error" in result) return { ok: false as const, error: result.error };
  const { order } = result;
  await updateConversation(conv.id, { customer_id: order.customer_id, customer_name: conv.customer_name || order.customer_name });
  const link = `${origin}/store/${store.slug}/order/${order.public_token}`;
  const payNote = ONLINE_METHODS.includes(method)
    ? `Pay with ${METHOD_LABELS[method]} here: ${link}`
    : method === "cod"
      ? "You'll pay cash on delivery."
      : `Payment: ${METHOD_LABELS[method]} — details are on your order page.`;
  return {
    ok: true as const,
    order,
    summary: `Order #${order.number} placed! Total ${formatMoney(order.total, store.currency)}. ${payNote}\nTrack your order: ${link}`,
  };
}
