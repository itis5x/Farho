"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { bookOrderDelivery } from "@/lib/actions/delivery";
import { cn } from "@/lib/utils";

export function BookDelivery({
  storeId,
  orderId,
  couriers,
  branches,
  suggestedBranch,
  cod,
}: {
  storeId: string;
  orderId: string;
  couriers: { pathao: boolean; ncm: boolean };
  branches: string[];
  suggestedBranch: string;
  cod: string;
}) {
  const [state, action] = useActionState(bookOrderDelivery.bind(null, storeId, orderId), undefined);
  const first = couriers.pathao ? "pathao" : couriers.ncm ? "ncm" : "own";
  const [courier, setCourier] = useState<"pathao" | "ncm" | "own">(first);
  const options = [
    ...(couriers.pathao ? [["pathao", "Pathao"] as const] : []),
    ...(couriers.ncm ? [["ncm", "NCM"] as const] : []),
    ["own", "Own rider / other"] as const,
  ];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="courier" value={courier} />
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 text-xs">
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setCourier(v)}
            className={cn("flex-1 rounded-md px-2 py-1.5 font-medium", courier === v ? "bg-white shadow-xs" : "text-zinc-600")}
          >
            {label}
          </button>
        ))}
      </div>
      {courier === "ncm" && (
        <div>
          <label className="label" htmlFor="branch">Delivering branch</label>
          <select id="branch" name="branch" defaultValue={suggestedBranch} className="input" required>
            <option value="">Choose…</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      )}
      {courier === "own" ? (
        <div className="grid grid-cols-2 gap-2">
          <input name="own_courier" className="input" placeholder="Courier / rider" />
          <input name="own_ref" className="input" placeholder="Tracking no. (optional)" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="weight">Weight (kg)</label>
            <input id="weight" name="weight" type="number" step="0.1" min="0.1" defaultValue="0.5" className="input" />
          </div>
          <div>
            <span className="label">Collect (COD)</span>
            <div className="input bg-zinc-50">{cod}</div>
          </div>
        </div>
      )}
      <input name="instruction" className="input" placeholder="Note for the rider (optional)" maxLength={250} />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Booking…">
        {courier === "own" ? "Mark out for delivery" : `Book ${courier === "pathao" ? "Pathao" : "NCM"} pickup`}
      </SubmitButton>
      {!couriers.pathao && !couriers.ncm && (
        <p className="text-xs text-zinc-500">Connect Pathao or Nepal Can Move in Delivery settings to book couriers here.</p>
      )}
    </form>
  );
}
