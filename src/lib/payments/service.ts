import "server-only";
import { headers } from "next/headers";
import { addLedgerEntry, addOrderEvent, getStoreSecret, updateOrderRow } from "@/lib/data";
import type { Order, Store } from "@/lib/types";
import { buildEsewaForm, ESEWA_TEST, type EsewaCredentials } from "./esewa";
import { khaltiInitiate, type KhaltiCredentials } from "./khalti";
import { getPaymentSettings, type GatewayMode, type PaymentMethod } from "./settings";

/** Farho Pay fee, in percent of the order total, on payments Farho collects for a store. */
export const FARHO_PAY_FEE_PERCENT = Number(process.env.FARHO_PAY_FEE_PERCENT ?? "1.5");

export type OwnEsewa = { product_code: string; secret_key: string; live: boolean };
export type OwnKhalti = { secret_key: string; live: boolean };

export async function esewaCredentials(store: Store): Promise<{ creds: EsewaCredentials; mode: GatewayMode } | null> {
  const settings = getPaymentSettings(store);
  if (settings.esewa.mode === "own") {
    const own = await getStoreSecret<OwnEsewa>(store.id, "esewa");
    if (!own) return null;
    return { creds: { productCode: own.product_code, secretKey: own.secret_key, live: own.live }, mode: "own" };
  }
  const code = process.env.FARHO_ESEWA_PRODUCT_CODE;
  const secret = process.env.FARHO_ESEWA_SECRET_KEY;
  // Without platform credentials Farho Pay runs against eSewa's public test environment.
  const creds = code && secret ? { productCode: code, secretKey: secret, live: process.env.FARHO_PAYMENTS_LIVE === "true" } : ESEWA_TEST;
  return { creds, mode: "farho" };
}

export async function khaltiCredentials(store: Store): Promise<{ creds: KhaltiCredentials; mode: GatewayMode } | null> {
  const settings = getPaymentSettings(store);
  if (settings.khalti.mode === "own") {
    const own = await getStoreSecret<OwnKhalti>(store.id, "khalti");
    return own ? { creds: { secretKey: own.secret_key, live: own.live }, mode: "own" } : null;
  }
  const secret = process.env.FARHO_KHALTI_SECRET_KEY;
  if (!secret) return null;
  return { creds: { secretKey: secret, live: process.env.FARHO_PAYMENTS_LIVE === "true" }, mode: "farho" };
}

/** Which methods a customer can actually use right now (online gateways need working credentials). */
export async function availableMethods(store: Store): Promise<PaymentMethod[]> {
  const s = getPaymentSettings(store);
  const out: PaymentMethod[] = [];
  if (s.cod.enabled) out.push("cod");
  if (s.esewa.enabled && (await esewaCredentials(store))) out.push("esewa");
  if (s.khalti.enabled && (await khaltiCredentials(store))) out.push("khalti");
  if (s.qr.enabled && s.qr.image_url) out.push("qr");
  if (s.bank.enabled && s.bank.details) out.push("bank");
  return out.length ? out : ["cod"];
}

export async function siteOrigin() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type PaymentStart =
  | { type: "form"; action: string; fields: Record<string, string> }
  | { type: "redirect"; url: string }
  | { type: "error"; message: string };

/** Starts (or restarts) an online payment for an unpaid order. */
export async function startOnlinePayment(store: Store, order: Order): Promise<PaymentStart> {
  const origin = await siteOrigin();
  if (order.payment_method === "esewa") {
    const c = await esewaCredentials(store);
    if (!c) return { type: "error", message: "eSewa isn't available for this store right now." };
    const uuid = `${order.number}-${Date.now().toString(36)}`;
    await updateOrderRow(order.id, { payment_ref: uuid, payment_gateway_mode: c.mode });
    // eSewa appends "?data=..." to the success URL, so the order token goes in the path.
    const back = `${origin}/api/pay/esewa/${order.public_token}`;
    return { type: "form", ...buildEsewaForm({ creds: c.creds, amount: order.total, transactionUuid: uuid, successUrl: back, failureUrl: `${back}/failed` }) };
  }
  if (order.payment_method === "khalti") {
    const c = await khaltiCredentials(store);
    if (!c) return { type: "error", message: "Khalti isn't available for this store right now." };
    try {
      const { pidx, paymentUrl } = await khaltiInitiate(c.creds, {
        amount: order.total,
        orderId: order.id,
        orderName: `${store.name} order #${order.number}`,
        returnUrl: `${origin}/api/pay/khalti/${order.public_token}`,
        websiteUrl: origin,
        customer: { name: order.customer_name, phone: order.phone, email: order.email },
      });
      await updateOrderRow(order.id, { payment_ref: pidx, payment_gateway_mode: c.mode });
      return { type: "redirect", url: paymentUrl };
    } catch (e) {
      return { type: "error", message: (e as Error).message };
    }
  }
  return { type: "error", message: "This order doesn't use online payment." };
}

/** Marks an order paid once the gateway confirmed it. Safe to call twice. */
export async function markOrderPaid(order: Order, gatewayRef: string) {
  if (order.payment_status === "paid") return;
  await updateOrderRow(order.id, { payment_status: "paid", paid_at: new Date().toISOString(), payment_ref: gatewayRef || order.payment_ref });
  const via = order.payment_method === "esewa" ? "eSewa" : order.payment_method === "khalti" ? "Khalti" : order.payment_method;
  await addOrderEvent(order.store_id, order.id, "payment", `Paid online with ${via} (ref ${gatewayRef || order.payment_ref})`);
  if (order.payment_gateway_mode === "farho") {
    const fee = Math.round(order.total * FARHO_PAY_FEE_PERCENT) / 100;
    await addLedgerEntry({ store_id: order.store_id, order_id: order.id, kind: "payment", amount: order.total, gateway: order.payment_method, note: `Order #${order.number}` });
    if (fee > 0)
      await addLedgerEntry({ store_id: order.store_id, order_id: order.id, kind: "fee", amount: -fee, gateway: order.payment_method, note: `Farho Pay fee ${FARHO_PAY_FEE_PERCENT}%` });
  }
}
