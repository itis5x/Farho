import { ActionForm } from "@/components/action-form";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { createCoupon, deleteCoupon, toggleCoupon } from "@/lib/actions/catalog";
import { requireStore } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Coupon } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Coupons" };

export default async function CouponsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const coupons = db.prepare("SELECT * FROM coupons WHERE store_id = ? ORDER BY created_at DESC").all(store.id) as Coupon[];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coupons</h1>
        <p className="text-sm text-zinc-600">Create discount codes customers can apply at checkout.</p>
      </div>
      <div className="card p-5">
        <ActionForm action={createCoupon.bind(null, store.id)} className="grid gap-4 sm:grid-cols-5 sm:items-end">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="code">Code</label>
            <input id="code" name="code" className="input uppercase" placeholder="DASHAIN20" required />
          </div>
          <div>
            <label className="label" htmlFor="kind">Type</label>
            <select id="kind" name="kind" className="input">
              <option value="percent">% off</option>
              <option value="fixed">{store.currency} off</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="value">Value</label>
            <input id="value" name="value" type="number" step="0.01" min="0" className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="min_subtotal">Min. order</label>
            <input id="min_subtotal" name="min_subtotal" type="number" step="0.01" min="0" defaultValue={0} className="input" />
          </div>
          <div className="sm:col-span-5">
            <SubmitButton pendingText="Creating…">Create coupon</SubmitButton>
          </div>
        </ActionForm>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-100 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Min. order</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {coupons.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  No coupons yet.
                </td>
              </tr>
            )}
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                <td className="px-4 py-3">{c.kind === "percent" ? `${c.value}%` : formatMoney(c.value, store.currency)}</td>
                <td className="px-4 py-3">{c.min_subtotal ? formatMoney(c.min_subtotal, store.currency) : "—"}</td>
                <td className="px-4 py-3">{c.times_used}×</td>
                <td className="px-4 py-3">
                  <form action={toggleCoupon.bind(null, store.id, c.id)}>
                    <button
                      className={`badge cursor-pointer ${c.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"}`}
                    >
                      {c.active ? "Active" : "Disabled"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-3 text-right">
                  <form action={deleteCoupon.bind(null, store.id, c.id)}>
                    <ConfirmButton className="btn px-2 py-1 text-rose-600 hover:bg-rose-50" message={`Delete coupon ${c.code}?`}>
                      Delete
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
