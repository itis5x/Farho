import "server-only";

export type NcmCredentials = { token: string; sandbox: boolean; pickup_branch: string };

const base = (sandbox: boolean) => (sandbox ? "https://demo.nepalcanmove.com" : "https://portal.nepalcanmove.com");

export type NcmBranch = { name: string; code: string; district: string; areas: string };

/** Public branch list (no token needed). */
export async function ncmBranches(sandbox = false): Promise<NcmBranch[]> {
  const res = await fetch(`${base(sandbox)}/api/v1/branchlist`, { next: { revalidate: 3600 } });
  const body = (await res.json()) as { data: string };
  const rows = JSON.parse(body.data) as (string | null)[][];
  return rows.map((r) => ({ name: r[0] ?? "", code: r[1] ?? "", areas: r[2] ?? "", district: r[4] ?? "" })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Best guess at the NCM branch that serves a customer's city. */
export function guessBranch(branches: NcmBranch[], city: string, address: string) {
  const text = `${city} ${address}`.toUpperCase();
  return (
    branches.find((b) => text.includes(b.name)) ??
    branches.find((b) => b.district && text.includes(b.district)) ??
    branches.find((b) => b.areas && city && b.areas.toUpperCase().includes(city.toUpperCase()))
  );
}

async function api<T>(c: NcmCredentials, path: string, init?: { method?: string; body?: object; query?: Record<string, string> }) {
  const url = new URL(`${base(c.sandbox)}${path}`);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { Authorization: `Token ${c.token}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const body = (await res.json().catch(() => ({}))) as T & { detail?: string; Error?: string | object; message?: string };
  if (!res.ok) throw new Error(`NCM: ${body.detail ?? (typeof body.Error === "string" ? body.Error : JSON.stringify(body.Error ?? body.message ?? res.status))}`);
  return body;
}

export async function ncmCreateOrder(
  c: NcmCredentials,
  o: { ref: string; name: string; phone: string; address: string; cod: number; branch: string; packageName: string; instruction: string; weightKg: number },
) {
  const body = await api<{ orderid?: number | string; data?: { orderid?: number | string } }>(c, "/api/v1/order/create", {
    method: "POST",
    body: {
      name: o.name,
      phone: o.phone,
      cod_charge: o.cod.toFixed(2),
      address: o.address,
      fbranch: c.pickup_branch,
      branch: o.branch,
      package: o.packageName.slice(0, 100),
      vref_id: o.ref,
      instruction: o.instruction,
      delivery_type: "Door2Door",
      weight: String(o.weightKg),
    },
  });
  const id = body.orderid ?? body.data?.orderid;
  if (!id) throw new Error("NCM didn't return an order id.");
  return { ref: String(id), status: "Pickup Order Created" };
}

export async function ncmStatus(c: NcmCredentials, orderId: string) {
  const body = await api<{ status?: string }[] | { status?: string }>(c, "/api/v1/order/status", { query: { id: orderId } });
  const list = Array.isArray(body) ? body : [body];
  return list[0]?.status ?? "Unknown";
}

/** Checks a token by asking NCM for the vendor's assigned branches. */
export async function ncmCheckToken(c: NcmCredentials) {
  await api(c, "/api/v2/vendor/assigned-branches");
}
