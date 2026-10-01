import type { Store } from "@/lib/types";

export type GatewayMode = "farho" | "own";

export type PaymentSettings = {
  cod: { enabled: boolean; label: string };
  esewa: { enabled: boolean; mode: GatewayMode };
  khalti: { enabled: boolean; mode: GatewayMode };
  qr: { enabled: boolean; label: string; image_url: string; instructions: string };
  bank: { enabled: boolean; details: string };
};

export const DEFAULT_PAYMENTS: PaymentSettings = {
  cod: { enabled: true, label: "Cash on delivery" },
  esewa: { enabled: false, mode: "farho" },
  khalti: { enabled: false, mode: "farho" },
  qr: { enabled: false, label: "Scan & pay (Fonepay / eSewa / bank QR)", image_url: "", instructions: "" },
  bank: { enabled: false, details: "" },
};

export type PaymentMethod = "cod" | "esewa" | "khalti" | "qr" | "bank";
export const PAYMENT_METHODS: PaymentMethod[] = ["cod", "esewa", "khalti", "qr", "bank"];
export const ONLINE_METHODS: PaymentMethod[] = ["esewa", "khalti"];
export const MANUAL_METHODS: PaymentMethod[] = ["qr", "bank"];

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "Cash on delivery",
  esewa: "eSewa",
  khalti: "Khalti",
  qr: "QR payment",
  bank: "Bank transfer",
};

export function getPaymentSettings(store: Pick<Store, "payments">): PaymentSettings {
  let saved: Partial<PaymentSettings> = {};
  try {
    saved = store.payments ? JSON.parse(store.payments) : {};
  } catch {
    /* fall back to defaults */
  }
  const out = structuredClone(DEFAULT_PAYMENTS);
  for (const m of PAYMENT_METHODS) Object.assign(out[m], saved[m] ?? {});
  return out;
}

export function enabledMethods(settings: PaymentSettings): PaymentMethod[] {
  const list = PAYMENT_METHODS.filter((m) => settings[m].enabled);
  return list.length ? list : ["cod"];
}
