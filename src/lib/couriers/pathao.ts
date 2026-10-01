import "server-only";

export type PathaoCredentials = {
  client_id: string;
  client_secret: string;
  username: string;
  password: string;
  sandbox: boolean;
  store_id?: number;
};

const base = (c: PathaoCredentials) => (c.sandbox ? "https://courier-api-sandbox.pathao.com" : "https://api-hermes.pathao.com");

const tokens = new Map<string, { token: string; expires: number }>();

async function token(c: PathaoCredentials) {
  const key = `${c.sandbox}:${c.client_id}:${c.username}`;
  const cached = tokens.get(key);
  if (cached && cached.expires > Date.now()) return cached.token;
  const res = await fetch(`${base(c)}/aladdin/api/v1/issue-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: c.client_id, client_secret: c.client_secret, username: c.username, password: c.password, grant_type: "password" }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; message?: string };
  if (!body.access_token) throw new Error(`Pathao login failed${body.message ? `: ${body.message}` : ""}.`);
  tokens.set(key, { token: body.access_token, expires: Date.now() + Math.min((body.expires_in ?? 3600) * 1000, 24 * 3600_000) - 60_000 });
  return body.access_token;
}

async function api<T>(c: PathaoCredentials, path: string, init?: { method?: string; body?: object }) {
  const res = await fetch(`${base(c)}${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Bearer ${await token(c)}`, "Content-Type": "application/json", Accept: "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as { data?: T; message?: string; errors?: Record<string, string[]> };
  if (!res.ok || !body.data) {
    const detail = body.errors ? Object.values(body.errors).flat().join(" ") : body.message;
    throw new Error(`Pathao: ${detail ?? res.status}`);
  }
  return body.data;
}

export async function pathaoStores(c: PathaoCredentials) {
  const data = await api<{ data: { store_id: number; store_name: string; store_address: string; is_active: number }[] }>(c, "/aladdin/api/v1/stores");
  return data.data.filter((s) => s.is_active);
}

export async function pathaoCreateOrder(
  c: PathaoCredentials,
  o: { ref: string; name: string; phone: string; address: string; cod: number; quantity: number; weightKg: number; description: string; instruction: string },
) {
  if (!c.store_id) throw new Error("Choose your Pathao pickup store in Delivery settings first.");
  const data = await api<{ consignment_id: string; order_status: string; delivery_fee: number }>(c, "/aladdin/api/v1/orders", {
    method: "POST",
    body: {
      store_id: c.store_id,
      merchant_order_id: o.ref,
      recipient_name: o.name,
      recipient_phone: o.phone,
      recipient_address: o.address,
      delivery_type: 48, // normal delivery
      item_type: 2, // parcel
      special_instruction: o.instruction,
      item_quantity: o.quantity,
      item_weight: String(o.weightKg),
      amount_to_collect: Math.round(o.cod),
      item_description: o.description.slice(0, 250),
    },
  });
  return { ref: data.consignment_id, status: data.order_status, fee: data.delivery_fee };
}

export async function pathaoStatus(c: PathaoCredentials, consignmentId: string) {
  const data = await api<{ order_status: string; order_status_slug?: string }>(c, `/aladdin/api/v1/orders/${encodeURIComponent(consignmentId)}/info`);
  return data.order_status;
}
