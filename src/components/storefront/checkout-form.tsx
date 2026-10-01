"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useCart } from "./cart";
import { placeOrder, quoteCart } from "@/lib/actions/orders";
import { cn, formatMoney } from "@/lib/utils";

type Quote = Awaited<ReturnType<typeof quoteCart>>;

export function CheckoutForm({ storeSlug, currency, buttonClass }: { storeSlug: string; currency: string; buttonClass: string }) {
  const { items, ready, clear } = useCart();
  const router = useRouter();
  const base = `/store/${storeSlug}`;
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [placing, startPlacing] = useTransition();
  const money = (n: number) => formatMoney(n, currency);
  const cartLines = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
  const cartKey = JSON.stringify(cartLines);

  const refreshQuote = useCallback(
    async (code: string) => {
      const q = await quoteCart(storeSlug, JSON.parse(cartKey), code);
      setQuote(q);
      if (!("error" in q)) setAppliedCoupon(q.couponApplied ?? "");
    },
    [storeSlug, cartKey],
  );

  useEffect(() => {
    if (ready && items.length) refreshQuote(appliedCoupon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cartKey]);

  if (!ready) return <div className="py-20 text-center text-zinc-500">Loading…</div>;
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link href={`${base}/products`} className="mt-4 inline-block text-brand underline">
          Continue shopping
        </Link>
      </div>
    );
  }

  const onSubmit = (form: FormData) => {
    setError("");
    form.set("coupon", appliedCoupon);
    startPlacing(async () => {
      const res = await placeOrder(storeSlug, cartLines, form);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      clear();
      router.push(`${base}/order/${res.token}?new=1`);
    });
  };

  const ok = quote && !("error" in quote) ? quote : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_400px]">
      <form action={onSubmit} className="space-y-6">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <section className="space-y-4">
          <h2 className="font-semibold">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="customer_name" label="Full name" required autoComplete="name" />
            <Field name="phone" label="Phone number" type="tel" required autoComplete="tel" placeholder="98XXXXXXXX" />
            <div className="sm:col-span-2">
              <Field name="email" label="Email (optional)" type="email" autoComplete="email" />
            </div>
          </div>
        </section>
        <section className="space-y-4">
          <h2 className="font-semibold">Delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="city" label="City" required autoComplete="address-level2" placeholder="Kathmandu" />
            <Field name="address" label="Street address / landmark" required autoComplete="street-address" />
          </div>
          <div>
            <label className="label" htmlFor="note">Order note (optional)</label>
            <textarea id="note" name="note" className="input min-h-20" placeholder="Anything we should know?" />
          </div>
        </section>
        <section className="space-y-2">
          <h2 className="font-semibold">Payment</h2>
          <label className="flex items-center gap-3 rounded-lg border-2 border-brand bg-brand/5 p-4">
            <input type="radio" checked readOnly className="accent-[var(--brand)]" />
            <span>
              <span className="font-medium">Cash on delivery</span>
              <span className="block text-sm text-zinc-600">Pay when your order arrives.</span>
            </span>
          </label>
        </section>
        {error && <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={placing || !ok}
          className={cn("w-full bg-brand py-4 text-lg font-semibold text-white hover:opacity-90 disabled:opacity-60", buttonClass)}
        >
          {placing ? "Placing order…" : ok ? `Place order · ${money(ok.total)}` : "Place order"}
        </button>
      </form>

      <aside className="h-fit rounded-2xl bg-zinc-50 p-6 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="mt-4 space-y-3">
          {items.map((it) => (
            <li key={it.productId} className="flex items-center gap-3 text-sm">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-200">
                {it.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute -right-0 -top-0 grid h-5 min-w-5 place-items-center rounded-bl-md bg-zinc-700 px-1 text-xs text-white">
                  {it.quantity}
                </span>
              </div>
              <span className="flex-1">{it.name}</span>
              <span className="font-medium">{money(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <input
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
            placeholder="Coupon code"
            className="input"
            aria-label="Coupon code"
          />
          <button type="button" className="btn-secondary" onClick={() => refreshQuote(coupon.trim())} disabled={!coupon.trim()}>
            Apply
          </button>
        </div>
        {quote && "couponError" in quote && quote.couponError && (
          <p className="mt-2 text-sm text-rose-600">{quote.couponError}</p>
        )}
        {quote && "error" in quote && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{quote.error}</p>}
        {ok && (
          <dl className="mt-6 space-y-2 border-t border-zinc-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{money(ok.subtotal)}</dd>
            </div>
            {ok.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>
                  Discount ({ok.couponApplied}){" "}
                  <button
                    type="button"
                    className="text-xs text-zinc-500 underline"
                    onClick={() => {
                      setCoupon("");
                      refreshQuote("");
                    }}
                  >
                    remove
                  </button>
                </dt>
                <dd>− {money(ok.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{ok.delivery ? money(ok.delivery) : "Free"}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-3 text-lg font-bold">
              <dt>Total</dt>
              <dd>{money(ok.total)}</dd>
            </div>
          </dl>
        )}
      </aside>
    </div>
  );
}

function Field({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
