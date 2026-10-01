"use client";

import { useState, useTransition } from "react";
import { payOrder } from "@/lib/actions/orders";
import { cn } from "@/lib/utils";
import { goToPayment } from "./submit-payment";

export function PayNowButton({ storeSlug, token, label, buttonClass }: { storeSlug: string; token: string; label: string; buttonClass: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const problem = goToPayment(await payOrder(storeSlug, token));
            if (problem) setError(problem);
          })
        }
        className={cn("w-full bg-brand px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60", buttonClass)}
      >
        {pending ? "Opening payment…" : label}
      </button>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  );
}
