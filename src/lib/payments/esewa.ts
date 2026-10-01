import "server-only";
import crypto from "node:crypto";

export type EsewaCredentials = { productCode: string; secretKey: string; live: boolean };

// Public UAT credentials from eSewa's developer docs (https://developer.esewa.com.np).
export const ESEWA_TEST: EsewaCredentials = { productCode: "EPAYTEST", secretKey: "8gBm/:&EnhH.1/q", live: false };

const FORM_URL = { test: "https://rc-epay.esewa.com.np/api/epay/main/v2/form", live: "https://epay.esewa.com.np/api/epay/main/v2/form" };
const STATUS_URL = { test: "https://rc.esewa.com.np/api/epay/transaction/status/", live: "https://esewa.com.np/api/epay/transaction/status/" };

function sign(message: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

/** eSewa wants plain numbers like "8250" or "8250.5". */
export function esewaAmount(n: number) {
  return String(Math.round(n * 100) / 100);
}

export function buildEsewaForm(opts: {
  creds: EsewaCredentials;
  amount: number;
  transactionUuid: string;
  successUrl: string;
  failureUrl: string;
}) {
  const total = esewaAmount(opts.amount);
  const signed = "total_amount,transaction_uuid,product_code";
  const fields: Record<string, string> = {
    amount: total,
    tax_amount: "0",
    total_amount: total,
    transaction_uuid: opts.transactionUuid,
    product_code: opts.creds.productCode,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: opts.successUrl,
    failure_url: opts.failureUrl,
    signed_field_names: signed,
    signature: sign(`total_amount=${total},transaction_uuid=${opts.transactionUuid},product_code=${opts.creds.productCode}`, opts.creds.secretKey),
  };
  return { action: FORM_URL[opts.creds.live ? "live" : "test"], fields };
}

export type EsewaCallback = {
  transaction_code: string;
  status: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
};

/** Decodes eSewa's base64 `data` redirect parameter and checks its signature. */
export function decodeEsewaCallback(data: string, creds: EsewaCredentials): EsewaCallback | null {
  try {
    const payload = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as EsewaCallback & Record<string, string>;
    const message = payload.signed_field_names
      .split(",")
      .map((f) => `${f}=${payload[f]}`)
      .join(",");
    const expected = sign(message, creds.secretKey);
    const a = Buffer.from(expected);
    const b = Buffer.from(payload.signature ?? "");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Asks eSewa directly whether a transaction completed (never trust the redirect alone). */
export async function esewaStatus(creds: EsewaCredentials, amount: number, transactionUuid: string) {
  const url = new URL(STATUS_URL[creds.live ? "live" : "test"]);
  url.searchParams.set("product_code", creds.productCode);
  url.searchParams.set("total_amount", esewaAmount(amount));
  url.searchParams.set("transaction_uuid", transactionUuid);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { status: "ERROR", ref_id: "" };
  const body = (await res.json()) as { status: string; ref_id: string | null };
  return { status: body.status, ref_id: body.ref_id ?? "" };
}
