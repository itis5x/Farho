import "server-only";
import { listProducts } from "@/lib/data";
import type { AutoReply, Conversation, Store } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import type { InboxSettings } from "./settings";
import { orderStatusText, productLine, searchProducts } from "./tools";

export const fill = (text: string, store: Store, origin: string) =>
  text.replaceAll("{store}", store.name).replaceAll("{link}", `${origin}/store/${store.slug}`);

const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(text));

/** Keyword rules set up by the store owner. Matches if any comma-separated keyword appears in the message. */
export function matchAutoReply(rules: AutoReply[], text: string) {
  const lower = text.toLowerCase();
  return rules.find(
    (r) =>
      r.active &&
      r.keywords
        .split(",")
        .map((k) => k.trim().toLowerCase())
        .filter(Boolean)
        .some((k) => lower.includes(k)),
  );
}

/** Built-in replies that work without AI: greetings, catalogue, prices and order status. */
export async function ruleReply(store: Store, conv: Conversation, text: string, isFirst: boolean, settings: InboxSettings, origin: string) {
  const shop = `${origin}/store/${store.slug}`;

  const orderNo = text.match(/#?\b(\d{4,6})\b/);
  const phone = text.match(/(\+?977[\s-]?)?\b(9\d{9}|0\d{6,9})\b/)?.[0];
  if (orderNo && (phone || has(text, "order", "status", "track", "tracking", "kahile", "kaha", "delivery", "parcel"))) {
    const res = await orderStatusText(store, Number(orderNo[1]), origin, phone);
    return res ? res.text : `I couldn't find order #${orderNo[1]}. Please check the number — it's in your order confirmation.`;
  }
  if (has(text, "order", "track", "status") && has(text, "my", "mero")) {
    return "Sure! Please send your order number and the phone number you ordered with (for example: 1023 9801234567).";
  }

  if (has(text, "menu", "catalog", "catalogue", "products", "items", "list", "collection", "k k cha", "ke ke")) {
    const products = (await listProducts(store.id, { activeOnly: true })).filter((p) => p.stock !== 0).slice(0, 8);
    if (!products.length) return `We're adding products soon! Check ${shop}`;
    return `Here's what we have:\n\n${products.map((p) => `• ${productLine(store, p, origin).split("\n")[0]}`).join("\n")}\n\nSee everything: ${shop}/products`;
  }

  if (has(text, "delivery", "shipping", "deliver")) {
    const free = store.free_delivery_over > 0 ? ` Free delivery on orders over ${formatMoney(store.free_delivery_over, store.currency)}.` : "";
    return store.delivery_charge > 0
      ? `Delivery costs ${formatMoney(store.delivery_charge, store.currency)}.${free} We deliver to your doorstep 🚚`
      : "Delivery is free! 🚚";
  }

  const hits = await searchProducts(store, text, 3);
  if (hits.length && hits[0].score >= 3) {
    const best = hits[0].score;
    const lines = hits.filter((h) => h.score >= Math.max(3, best * 0.6)).map((h) => productLine(store, h.product, origin));
    return `${lines.join("\n\n")}\n\nWant to order? Tap the link, or tell me your name, phone and address.`;
  }

  if (isFirst || has(text, "hi", "hello", "hey", "namaste", "namaskar", "hlo", "helo")) return fill(settings.greeting, store, origin);
  return fill(settings.fallback, store, origin);
}
