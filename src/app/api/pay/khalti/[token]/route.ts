import { NextResponse } from "next/server";
import { getOrderByPublicToken, getStore } from "@/lib/data";
import { khaltiLookup } from "@/lib/payments/khalti";
import { khaltiCredentials, markOrderPaid, siteOrigin } from "@/lib/payments/service";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = await siteOrigin();
  const order = await getOrderByPublicToken(token);
  const store = order ? await getStore(order.store_id) : null;
  if (!order || !store) return NextResponse.redirect(`${origin}/`);
  const back = (q: string) => NextResponse.redirect(`${origin}/store/${store.slug}/order/${order.public_token}?${q}`);

  if (order.payment_status === "paid") return back("payment=paid");
  const c = await khaltiCredentials(store);
  if (!c || !order.payment_ref) return back("payment=failed");

  // Never trust the redirect's query string: look the payment up with Khalti using the pidx we stored.
  const res = await khaltiLookup(c.creds, order.payment_ref);
  if (res.status !== "Completed") return back(res.status === "User canceled" ? "payment=cancelled" : "payment=failed");
  if (Math.abs(res.amountPaisa - Math.round(order.total * 100)) > 1) return back("payment=failed");

  await markOrderPaid(order, res.transactionId);
  return back("payment=paid");
}
