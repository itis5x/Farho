import "server-only";

export type KhaltiCredentials = { secretKey: string; live: boolean };

const BASE = { test: "https://dev.khalti.com/api/v2", live: "https://khalti.com/api/v2" };

async function call<T>(creds: KhaltiCredentials, path: string, body: object): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(`${BASE[creds.live ? "live" : "test"]}${path}`, {
    method: "POST",
    headers: { Authorization: `Key ${creds.secretKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as T };
}

export async function khaltiInitiate(
  creds: KhaltiCredentials,
  p: {
    amount: number;
    orderId: string;
    orderName: string;
    returnUrl: string;
    websiteUrl: string;
    customer: { name: string; phone: string; email?: string };
  },
) {
  const { ok, data } = await call<{ pidx?: string; payment_url?: string; detail?: string }>(creds, "/epayment/initiate/", {
    return_url: p.returnUrl,
    website_url: p.websiteUrl,
    amount: Math.round(p.amount * 100), // paisa
    purchase_order_id: p.orderId,
    purchase_order_name: p.orderName.slice(0, 100),
    customer_info: { name: p.customer.name, phone: p.customer.phone, ...(p.customer.email ? { email: p.customer.email } : {}) },
  });
  if (!ok || !data.pidx || !data.payment_url) {
    throw new Error(`Khalti could not start the payment${data.detail ? `: ${data.detail}` : ""}.`);
  }
  return { pidx: data.pidx, paymentUrl: data.payment_url };
}

export async function khaltiLookup(creds: KhaltiCredentials, pidx: string) {
  const { data } = await call<{ status?: string; total_amount?: number; transaction_id?: string }>(creds, "/epayment/lookup/", { pidx });
  return { status: data.status ?? "Unknown", amountPaisa: data.total_amount ?? 0, transactionId: data.transaction_id ?? "" };
}
