import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { firstRow, Query } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { applyCourierStatus } from "@/lib/couriers/service";
import { getStoreSecret } from "@/lib/data";
import type { Order } from "@/lib/types";

/** Status updates pushed by Pathao or NCM. The secret path segment authenticates the caller. */
export async function POST(req: Request, { params }: { params: Promise<{ storeId: string; secret: string }> }) {
  const { storeId, secret } = await params;
  const saved = /^[a-zA-Z0-9]{1,36}$/.test(storeId) ? await getStoreSecret<{ secret: string }>(storeId, "courier:webhook") : null;
  if (!saved || saved.secret.length !== secret.length || !crypto.timingSafeEqual(Buffer.from(saved.secret), Buffer.from(secret))) {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const ref = String(body.consignment_id ?? body.order_id ?? body.orderid ?? "");
  const status = String(body.order_status ?? body.status ?? body.event ?? "");
  if (ref && status) {
    const order = await firstRow<Order>(TABLES.orders, [Query.equal("store_id", storeId), Query.equal("courier_ref", ref)]);
    if (order) await applyCourierStatus(order, status);
  }
  return NextResponse.json({ ok: true }, { status: 202 });
}
