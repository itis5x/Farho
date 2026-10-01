import { toCsv } from "@/lib/csv";
import { listOrderItems, listOrders } from "@/lib/data";
import { csvResponse, ownedStore } from "@/lib/export-auth";

export async function GET(_req: Request, { params }: { params: Promise<{ storeId: string }> }) {
  const store = await ownedStore((await params).storeId);
  if (!store) return new Response("Not found", { status: 404 });
  const orders = await listOrders(store.id);
  const items = await listOrderItems(orders.map((o) => o.id));
  const rows: unknown[][] = [
    ["Order", "Date", "Status", "Payment", "Paid", "Source", "Customer", "Phone", "Address", "City", "Items", "Subtotal", "Discount", "Delivery", "Total", "Courier", "Tracking"],
  ];
  for (const o of orders) {
    const list = items
      .filter((i) => i.order_id === o.id)
      .map((i) => `${i.quantity}× ${i.name}${i.variant_title ? ` (${i.variant_title})` : ""}`)
      .join("; ");
    rows.push([o.number, o.created_at, o.status, o.payment_method, o.payment_status, o.source || "website", o.customer_name, o.phone, o.address, o.city, list, o.subtotal, o.discount, o.delivery_charge, o.total, o.courier, o.courier_ref]);
  }
  return csvResponse(toCsv(rows), `${store.slug}-orders.csv`);
}
