"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { saveSms } from "@/lib/actions/sms";

export function SmsForm({ storeId, current }: { storeId: string; current: { provider: string; sender: string; hasToken: boolean; events: { placed: boolean; shipped: boolean; delivered: boolean } } | null }) {
  const [state, action] = useActionState(saveSms.bind(null, storeId), undefined);
  const ev = current?.events ?? { placed: true, shipped: true, delivered: false };
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">📲 SMS notifications</h2>
        <p className="text-sm text-zinc-600">
          Text customers automatically when their order is placed, shipped or delivered. Uses your own{" "}
          <a href="https://sparrowsms.com" target="_blank" className="text-indigo-600 underline">Sparrow SMS</a> or{" "}
          <a href="https://aakashsms.com" target="_blank" className="text-indigo-600 underline">Aakash SMS</a> account (about Rs. 1 per SMS).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="provider" defaultValue={current?.provider ?? "sparrow"} className="input" aria-label="SMS provider">
          <option value="sparrow">Sparrow SMS</option>
          <option value="aakash">Aakash SMS</option>
        </select>
        <input name="token" type="password" className="input" placeholder={current?.hasToken ? "•••••• (saved)" : "API token"} autoComplete="off" />
        <input name="sender" defaultValue={current?.sender} className="input" placeholder="Sender ID (Sparrow)" />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        {(["placed", "shipped", "delivered"] as const).map((e) => (
          <label key={e} className="flex items-center gap-2 capitalize">
            <input type="checkbox" name={e} defaultChecked={ev[e]} className="h-4 w-4" /> Order {e}
          </label>
        ))}
      </div>
      <input name="test_to" className="input" placeholder="Send a test SMS to (optional) 98XXXXXXXX" />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton>Save SMS settings</SubmitButton>
        {current && (
          <button name="disconnect" value="1" className="btn px-3 text-rose-600 hover:bg-rose-50">Turn off</button>
        )}
      </div>
    </form>
  );
}
