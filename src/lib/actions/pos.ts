"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { addOrderEvent, updateOrderRow } from "@/lib/data";
import { createOrder } from "@/lib/orders";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/settings";

const id = z.string().regex(/^[a-zA-Z0-9._-]{1,36}$/);
const schema = z.object({
  mode: z.enum(["pos", "delivery"]),
  items: z.array(z.object({ productId: id, variantId: id.optional(), quantity: z.number().int().min(1).max(999) })).min(1, "Add at least one item.").max(100),
  customer: z.object({
    name: z.string().trim().max(100).default(""),
    phone: z.string().trim().max(20).default(""),
    address: z.string().trim().max(250).default(""),
    city: z.string().trim().max(80).default(""),
    email: z.string().trim().max(200).default(""),
  }),
  payment_method: z.enum(PAYMENT_METHODS as [PaymentMethod, ...PaymentMethod[]]),
  paid: z.boolean(),
  discount: z.number().min(0).default(0),
  delivery: z.number().min(0).nullable().default(null),
  note: z.string().trim().max(500).default(""),
  source: z.enum(["manual", "pos", "messenger", "instagram", "whatsapp", "telegram"]).default("manual"),
});

export type ManualOrderInput = z.input<typeof schema>;

/** Creates an order from the admin panel: a counter sale (POS) or a phone/DM delivery order. */
export async function createManualOrder(storeId: string, input: ManualOrderInput): Promise<{ error?: string; orderId?: string; number?: number; total?: number }> {
  const { store } = await requireStore(storeId);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const pos = d.mode === "pos";

  const phone = d.customer.phone.replace(/[\s-]/g, "");
  if (!pos) {
    if (d.customer.name.length < 2) return { error: "Enter the customer's name." };
    if (!/^\+?\d{7,16}$/.test(phone)) return { error: "Enter a valid phone number." };
    if (d.customer.address.length < 3) return { error: "Enter the delivery address." };
  }

  const result = await createOrder({
    store,
    cart: d.items,
    customer: {
      name: d.customer.name || "Walk-in customer",
      // Walk-in sales share one customer record unless a phone number is given.
      phone: phone || "0000000000",
      email: d.customer.email,
      address: d.customer.address || "In store",
      city: d.customer.city || "",
    },
    note: d.note,
    paymentMethod: d.payment_method,
    source: pos ? "pos" : d.source,
    event: pos ? "Counter sale (POS)" : `Order added by the store${d.source !== "manual" ? ` from ${d.source}` : ""}`,
    extraDiscount: d.discount,
    deliveryCharge: pos ? 0 : (d.delivery ?? undefined),
  });
  if ("error" in result) return { error: result.error };
  const { order } = result;

  if (pos || d.paid) {
    await updateOrderRow(order.id, {
      payment_status: d.paid ? "paid" : "unpaid",
      ...(d.paid ? { paid_at: new Date().toISOString() } : {}),
      ...(pos ? { status: "delivered" as const } : { status: "confirmed" as const }),
    });
    if (d.paid) await addOrderEvent(store.id, order.id, "payment", `Paid at the counter (${d.payment_method})`);
  }
  revalidatePath(`/dashboard/${store.id}`, "layout");
  return { orderId: order.id, number: order.number, total: order.total };
}
