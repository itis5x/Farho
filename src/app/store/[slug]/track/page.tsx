import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getStorefront } from "@/lib/store-data";
import { THEME_STYLES } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export const metadata = { title: "Track your order" };

export default async function TrackPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ number?: string; phone?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { store, hidden } = await getStorefront(slug);
  if (hidden) return null;

  let notFoundMsg = false;
  if (sp.number && sp.phone) {
    const number = Number(sp.number.replace(/^#/, ""));
    const phone = sp.phone.replace(/[\s-]/g, "");
    const row = db
      .prepare("SELECT public_token FROM orders WHERE store_id = ? AND number = ? AND phone = ?")
      .get(store.id, number, phone) as { public_token: string } | undefined;
    if (row) redirect(`/store/${store.slug}/order/${row.public_token}`);
    notFoundMsg = true;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-center text-3xl font-bold">Track your order</h1>
      <p className="mt-2 text-center text-zinc-600">Enter your order number and the phone number you used at checkout.</p>
      <form className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="number">Order number</label>
          <input id="number" name="number" defaultValue={sp.number} className="input" placeholder="1001" required />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone number</label>
          <input id="phone" name="phone" defaultValue={sp.phone} className="input" type="tel" required />
        </div>
        {notFoundMsg && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">We couldn&apos;t find an order with those details.</p>
        )}
        <button className={cn("w-full bg-brand py-3 font-semibold text-white", THEME_STYLES[store.theme].button)}>Track order</button>
      </form>
    </div>
  );
}
