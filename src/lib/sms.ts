import "server-only";
import { getStore, getStoreSecret } from "./data";
import type { Order, Store } from "./types";
import { formatMoney } from "./utils";

export type SmsSettings = {
  provider: "sparrow" | "aakash";
  token: string;
  sender: string;
  events: { placed: boolean; shipped: boolean; delivered: boolean };
};

export const getSms = (storeId: string) => getStoreSecret<SmsSettings>(storeId, "sms");

/** Nepali mobile numbers only (98/97XXXXXXXX), as the gateways expect them. */
export function nepaliMobile(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^977/, "");
  return /^9[78]\d{8}$/.test(digits) ? digits : null;
}

export async function sendSms(s: Pick<SmsSettings, "provider" | "token" | "sender">, to: string, text: string) {
  const body =
    s.provider === "sparrow"
      ? new URLSearchParams({ token: s.token, from: s.sender || "Demo", to, text })
      : new URLSearchParams({ auth_token: s.token, to, text });
  const url = s.provider === "sparrow" ? "https://api.sparrowsms.com/v2/sms/" : "https://sms.aakashsms.com/sms/v3/send";
  const res = await fetch(url, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  const data = (await res.json().catch(() => ({}))) as { response?: string; message?: string; error?: boolean };
  if (!res.ok || data.error) throw new Error(data.response ?? data.message ?? `SMS gateway returned ${res.status}`);
}

const MESSAGES = {
  placed: (s: Store, o: Order) => `${s.name}: Order #${o.number} received! Total ${formatMoney(o.total, s.currency)}. We'll call you to confirm. Thank you!`,
  shipped: (s: Store, o: Order) => `${s.name}: Your order #${o.number} is on the way${o.courier_ref ? ` (tracking ${o.courier_ref})` : ""}.`,
  delivered: (s: Store, o: Order) => `${s.name}: Order #${o.number} delivered. Thank you for shopping with us!`,
};

/** Sends an order update SMS if the store has SMS set up for this event. Never throws. */
export async function notifyOrder(order: Order, event: keyof typeof MESSAGES, storeArg?: Store) {
  try {
    if (order.source === "pos") return;
    const sms = await getSms(order.store_id);
    const to = nepaliMobile(order.phone);
    if (!sms?.events[event] || !to) return;
    const store = storeArg ?? (await getStore(order.store_id));
    if (store) await sendSms(sms, to, MESSAGES[event](store, order));
  } catch (e) {
    console.error("SMS failed", e);
  }
}
