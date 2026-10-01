"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { submitReview } from "@/lib/actions/reviews";
import { cn } from "@/lib/utils";

export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.round(value);
  return (
    <span className={cn("text-amber-400", className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {"★".repeat(full)}
      <span className="text-zinc-300">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function ReviewForm({ storeSlug, productId, buttonClass }: { storeSlug: string; productId: string; buttonClass: string }) {
  const [state, action] = useActionState(submitReview.bind(null, storeSlug, productId), undefined);
  const [rating, setRating] = useState(0);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.ok}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn("border-2 border-brand px-5 py-2 font-semibold text-brand", buttonClass)}>
        ✍️ Write a review
      </button>
    );
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-zinc-200 p-5">
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1 text-3xl" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className={n <= rating ? "text-amber-400" : "text-zinc-300"} aria-label={`${n} star${n > 1 ? "s" : ""}`}>
            ★
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="name" className="input" placeholder="Your name" required />
        <input name="phone" className="input" placeholder="Phone you ordered with (for a Verified badge)" />
      </div>
      <textarea name="text" className="input min-h-24" placeholder="What did you like? How was the quality and delivery?" maxLength={1500} />
      <FormMessage state={state} />
      <SubmitButton className={cn("bg-brand px-5 py-2 font-semibold text-white", buttonClass)} pendingText="Posting…">
        Post review
      </SubmitButton>
    </form>
  );
}
