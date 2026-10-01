import { PaymentsForm } from "./form";
import { requireStore } from "@/lib/auth";
import { mask } from "@/lib/crypto";
import { getStoreSecret, listLedger } from "@/lib/data";
import { FARHO_PAY_FEE_PERCENT, type OwnEsewa, type OwnKhalti } from "@/lib/payments/service";
import { getPaymentSettings } from "@/lib/payments/settings";
import { formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Payments" };

export default async function PaymentsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId, "owner");
  const [esewa, khalti, ledger] = await Promise.all([
    getStoreSecret<OwnEsewa>(store.id, "esewa"),
    getStoreSecret<OwnKhalti>(store.id, "khalti"),
    listLedger(store.id),
  ]);
  const farhoKhalti = !!process.env.FARHO_KHALTI_SECRET_KEY;
  const farhoEsewaLive = !!process.env.FARHO_ESEWA_SECRET_KEY && process.env.FARHO_PAYMENTS_LIVE === "true";
  const balance = ledger.reduce((s, e) => s + e.amount, 0);
  const money = (n: number) => formatMoney(n, store.currency);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-zinc-600">
          Choose how customers pay. With <strong>Farho Pay</strong> you can accept eSewa and Khalti without your own merchant
          account — we collect the payment and pay it out to you ({FARHO_PAY_FEE_PERCENT}% fee).
        </p>
      </div>

      <PaymentsForm
        storeId={store.id}
        settings={getPaymentSettings(store)}
        own={{
          esewa: esewa ? { code: esewa.product_code, secret: mask(esewa.secret_key), live: esewa.live } : null,
          khalti: khalti ? { secret: mask(khalti.secret_key), live: khalti.live } : null,
        }}
        farho={{ khaltiAvailable: farhoKhalti, esewaLive: farhoEsewaLive }}
      />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-4">
          <h2 className="font-semibold">Farho Pay balance</h2>
          <span className="text-xl font-bold">{money(balance)}</span>
        </div>
        <p className="px-5 pt-3 text-sm text-zinc-600">
          Online payments collected by Farho Pay, minus fees and payouts. Payouts are sent to your bank account weekly.
        </p>
        {ledger.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">No Farho Pay transactions yet.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <tbody className="divide-y divide-zinc-100">
              {ledger.slice(0, 50).map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-2 text-zinc-500">{formatDate(e.created_at)}</td>
                  <td className="px-5 py-2 capitalize">{e.kind}</td>
                  <td className="px-5 py-2 text-zinc-600">{e.note}</td>
                  <td className={`px-5 py-2 text-right font-medium ${e.amount < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                    {e.amount < 0 ? "−" : "+"} {money(Math.abs(e.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
