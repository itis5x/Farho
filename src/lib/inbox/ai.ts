import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { availableMethods } from "@/lib/payments/service";
import { METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/settings";
import type { Conversation, Message, Store } from "@/lib/types";
import { listVariants, productOptions } from "@/lib/data";
import { formatMoney } from "@/lib/utils";
import type { InboxSettings } from "./settings";
import { orderStatusText, placeChatOrder, productLine, searchProducts } from "./tools";

const MODEL = process.env.FARHO_AI_MODEL || "claude-opus-5-5";

export const aiAvailable = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const searchInput = z.object({ query: z.string().min(1).max(200) });
const orderStatusInput = z.object({ order_number: z.number().int().positive(), phone: z.string().max(20) });
const placeOrderInput = z.object({
  customer_name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9\s-]{7,16}$/),
  address: z.string().min(4).max(250),
  city: z.string().min(2).max(80),
  items: z
    .array(z.object({ product_id: z.string().min(1).max(36), variant_id: z.string().max(36), quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(20),
  payment_method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
  note: z.string().max(500).optional(),
});

function tools(takeOrders: boolean, methods: PaymentMethod[]): Anthropic.Beta.BetaTool[] {
  const list: Anthropic.Beta.BetaTool[] = [
    {
      name: "search_products",
      description:
        "Search this store's products by name, category or description. Returns ids, prices, stock and links. Use it before mentioning any product or price.",
      strict: true,
      input_schema: {
        type: "object",
        properties: { query: { type: "string", description: "What the customer is looking for, e.g. 'red pashmina shawl'" } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "get_order_status",
      description:
        "Look up an existing order by its order number (e.g. 1023). The tracking link and details are only returned when the phone number matches the order; pass an empty string if the customer hasn't given it.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          order_number: { type: "integer" },
          phone: { type: "string", description: "Phone number the customer says they ordered with, or empty" },
        },
        required: ["order_number", "phone"],
        additionalProperties: false,
      },
    },
  ];
  if (takeOrders) {
    list.push({
      name: "place_order",
      description:
        "Create an order for the customer. Only call this after the customer has explicitly confirmed the items, quantities, total, delivery details and payment method you summarised for them.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          phone: { type: "string", description: "Customer's phone number, digits only" },
          address: { type: "string", description: "Street address or landmark" },
          city: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                variant_id: { type: "string", description: "Variant id from search_products for products with options (size/colour); empty string otherwise" },
                quantity: { type: "integer" },
              },
              required: ["product_id", "variant_id", "quantity"],
              additionalProperties: false,
            },
          },
          payment_method: { type: "string", enum: methods },
          note: { type: "string", description: "Anything else the customer asked for (size, colour, delivery time)" },
        },
        required: ["customer_name", "phone", "address", "city", "items", "payment_method"],
        additionalProperties: false,
      },
    });
  }
  return list;
}

function systemPrompt(store: Store, settings: InboxSettings, methods: PaymentMethod[], origin: string) {
  const delivery =
    store.delivery_charge > 0
      ? `Delivery costs ${formatMoney(store.delivery_charge, store.currency)}${store.free_delivery_over > 0 ? `, free on orders over ${formatMoney(store.free_delivery_over, store.currency)}` : ""}.`
      : "Delivery is free.";
  return `You are the shopping assistant for "${store.name}", an online store${store.tagline ? ` (${store.tagline})` : ""}. You are chatting with a customer in a direct message.

About the store: ${store.about || "—"}
Store website: ${origin}/store/${store.slug}
${delivery}
Payment methods: ${methods.map((m) => METHOD_LABELS[m]).join(", ")}.
${store.contact_phone ? `Phone: ${store.contact_phone}.` : ""} ${store.address ? `Address: ${store.address}.` : ""}

How to help:
- Write like a friendly shop assistant in a chat app: short messages, plain text, no markdown headings or tables. Reply in the customer's language — English, Nepali, or Romanized Nepali.
- Use search_products before naming any product or price, and only mention what it returns. Never invent products, prices, stock, discounts or delivery times. Share product links from the tool results.
- For order questions, ask for the order number and the phone number used for the order, then use get_order_status. Never share order details the tool didn't return.
${
  settings.take_orders
    ? `- To take an order, collect: items and quantities, name, phone, address, city and payment method. Then summarise the items, total (including delivery) and details and ask the customer to confirm. Only call place_order after they say yes, then send them the order number and link from the result.`
    : "- You can't place orders in chat; send the customer the product link so they can order on the website."
}
- If you can't help (complaints, refunds, custom requests), say a team member will follow up.
${settings.ai_instructions ? `\nInstructions from the store owner:\n${settings.ai_instructions}` : ""}`;
}

/** Turns stored chat history into Messages API turns (customer = user, store = assistant). */
function toTurns(history: Message[]): Anthropic.Beta.BetaMessageParam[] {
  const turns: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    const role = m.direction === "in" ? "user" : "assistant";
    if (!turns.length && role === "assistant") continue; // must start with the customer
    turns.push({ role, content: m.text });
  }
  return turns;
}

/** Runs the assistant for the latest customer message. Returns its reply, or null to fall back to built-in rules. */
export async function aiReply(store: Store, conv: Conversation, history: Message[], settings: InboxSettings, origin: string) {
  if (!aiAvailable() || !settings.ai_enabled) return null;
  const methods = await availableMethods(store);
  const messages = toTurns(history.slice(-30));
  if (!messages.length) return null;

  try {
    for (let step = 0; step < 6; step++) {
      const response = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low" },
        system: systemPrompt(store, settings, methods, origin),
        tools: tools(settings.take_orders, methods),
        messages,
      });

      if (response.stop_reason === "refusal") return null;
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || !calls.length) return text || null;

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        results.push({ type: "tool_result", tool_use_id: call.id, ...(await runTool(store, conv, call, origin)) });
      }
      messages.push({ role: "user", content: results });
    }
    return null;
  } catch (e) {
    console.error("AI assistant failed", e);
    return null;
  }
}

async function runTool(store: Store, conv: Conversation, call: Anthropic.Beta.BetaToolUseBlock, origin: string) {
  const fail = (msg: string) => ({ content: msg, is_error: true });
  if (call.name === "search_products") {
    const input = searchInput.safeParse(call.input);
    if (!input.success) return fail("Invalid input");
    const hits = await searchProducts(store, input.data.query, 6);
    if (!hits.length) return { content: "No matching products." };
    const lines = await Promise.all(
      hits.map(async ({ product: p }) => {
        let line = `id=${p.id} | ${productLine(store, p, origin).replace("\n", " | ")}${p.description ? ` | ${p.description.slice(0, 200)}` : ""}`;
        if (productOptions(p).length) {
          const variants = await listVariants(p.id);
          line += `\n  options (customer must pick one): ${variants
            .map((v) => `variant_id=${v.id} ${v.title} ${formatMoney(v.price ?? p.price, store.currency)}${v.stock === 0 ? " SOLD OUT" : v.stock != null ? ` (${v.stock} left)` : ""}`)
            .join("; ")}`;
        }
        return line;
      }),
    );
    return { content: lines.join("\n") };
  }
  if (call.name === "get_order_status") {
    const input = orderStatusInput.safeParse(call.input);
    if (!input.success) return fail("Invalid input");
    const res = await orderStatusText(store, input.data.order_number, origin, input.data.phone);
    return { content: res ? res.text : "No order with that number." };
  }
  if (call.name === "place_order") {
    const input = placeOrderInput.safeParse(call.input);
    if (!input.success) return fail(`Invalid order details: ${input.error.issues[0].message}`);
    const res = await placeChatOrder(store, conv, input.data, origin);
    return res.ok ? { content: res.summary } : fail(res.error);
  }
  return fail("Unknown tool");
}
