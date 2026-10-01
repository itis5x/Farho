import Link from "next/link";
import { SubmitButton } from "@/components/form";
import { moderateReview, replyToReview } from "@/lib/actions/reviews";
import { requireStore } from "@/lib/auth";
import { listProducts, listStoreReviews } from "@/lib/data";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Reviews" };

export default async function ReviewsPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ show?: string }> }) {
  const { storeId } = await params;
  const show = (await searchParams).show === "pending" ? "pending" : "all";
  const { store } = await requireStore(storeId);
  const [reviews, products] = await Promise.all([listStoreReviews(store.id), listProducts(store.id)]);
  const productName = new Map(products.map((p) => [p.id, p]));
  const pending = reviews.filter((r) => !r.approved);
  const list = show === "pending" ? pending : reviews;
  const avg = reviews.filter((r) => r.approved).reduce((s, r, _, a) => s + r.rating / a.length, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-zinc-600">
            Reviews from verified buyers go live automatically; others wait for you here.
            {avg > 0 && <> Average rating: <strong>{avg.toFixed(1)} ★</strong></>}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm shadow-xs ring-1 ring-zinc-200">
          <Link href="?show=all" className={cn("rounded-md px-3 py-1.5", show === "all" ? "bg-indigo-600 text-white" : "text-zinc-600")}>All ({reviews.length})</Link>
          <Link href="?show=pending" className={cn("rounded-md px-3 py-1.5", show === "pending" ? "bg-indigo-600 text-white" : "text-zinc-600")}>Waiting ({pending.length})</Link>
        </div>
      </div>
      <div className="space-y-3">
        {list.length === 0 && <div className="card p-10 text-center text-sm text-zinc-500">No reviews here yet.</div>}
        {list.map((r) => {
          const product = productName.get(r.product_id);
          return (
            <div key={r.id} className={cn("card space-y-2 p-5", !r.approved && "border-amber-300")}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-amber-400">{"★".repeat(r.rating)}<span className="text-zinc-300">{"★".repeat(5 - r.rating)}</span></span>
                <span className="font-semibold">{r.name}</span>
                {r.verified && <span className="badge bg-emerald-100 text-emerald-800 normal-case">✓ Verified buyer</span>}
                {!r.approved && <span className="badge bg-amber-100 text-amber-800 normal-case">Waiting for approval</span>}
                <span className="text-xs text-zinc-400">{formatDate(r.created_at)}</span>
                {product && (
                  <Link href={`/dashboard/${store.id}/products/${product.id}`} className="ml-auto text-xs text-indigo-600 hover:underline">{product.name}</Link>
                )}
              </div>
              {r.text && <p className="whitespace-pre-line text-sm text-zinc-700">{r.text}</p>}
              <form action={replyToReview.bind(null, store.id, r.id)} className="flex gap-2">
                <input name="reply" defaultValue={r.reply} className="input text-sm" placeholder="Reply publicly (optional)" />
                <SubmitButton className="btn-secondary px-3 text-xs" pendingText="…">Reply</SubmitButton>
              </form>
              <div className="flex gap-2">
                {!r.approved ? (
                  <form action={moderateReview.bind(null, store.id, r.id, "approve")}>
                    <SubmitButton className="btn-primary px-3 py-1.5 text-xs" pendingText="…">Approve</SubmitButton>
                  </form>
                ) : (
                  <form action={moderateReview.bind(null, store.id, r.id, "hide")}>
                    <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="…">Hide</SubmitButton>
                  </form>
                )}
                <form action={moderateReview.bind(null, store.id, r.id, "delete")}>
                  <SubmitButton className="btn px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50" pendingText="…">Delete</SubmitButton>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
