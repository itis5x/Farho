import { NextResponse, type NextRequest } from "next/server";
import { getOrderByPublicToken, getStore } from "@/lib/data";
import { decodeEsewaCallback, esewaStatus } from "@/lib/payments/esewa";
import { esewaCredentials, markOrderPaid, siteOrigin } from "@/lib/payments/service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string; failed?: string[] }> }) {
  const { token, failed } = await params;
  const origin = await siteOrigin();
  const order = await getOrderByPublicToken(token);
  const store = order ? await getStore(order.store_id) : null;
  if (!order || !store) return NextResponse.redirect(`${origin}/`);
  const back = (q: string) => NextResponse.redirect(`${origin}/store/${store.slug}/order/${order.public_token}?${q}`);

  if (order.payment_status === "paid") return back("payment=paid");
  if (failed?.length) return back("payment=cancelled");

  const c = await esewaCredentials(store);
  // eSewa sometimes appends "?data=" to a URL that already has a query string; take whatever follows "data=".
  const raw = req.nextUrl.searchParams.get("data") ?? req.nextUrl.search.split("data=")[1] ?? "";
  const cb = c ? decodeEsewaCallback(decodeURIComponent(raw), c.creds) : null;
  if (!c || !cb || cb.transaction_uuid !== order.payment_ref || cb.status !== "COMPLETE") return back("payment=failed");

  // Confirm with eSewa's server and make sure the full amount was paid.
  const check = await esewaStatus(c.creds, order.total, order.payment_ref);
  const paid = Number(String(cb.total_amount).replace(/,/g, ""));
  if (check.status !== "COMPLETE" || Math.abs(paid - order.total) > 0.01) return back("payment=failed");

  await markOrderPaid(order, check.ref_id || cb.transaction_code);
  return back("payment=paid");
}
