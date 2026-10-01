"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { connectNcm, connectPathao } from "@/lib/actions/delivery";

export function PathaoForm({ storeId, connected, sandbox }: { storeId: string; connected: boolean; sandbox: boolean }) {
  const [state, action] = useActionState(connectPathao.bind(null, storeId), undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-zinc-600">
        Find these in <a href="https://parcel.pathao.com/courier/developer-api" target="_blank" className="text-indigo-600 underline">Pathao merchant panel → Developer API</a>.
        {connected && " Leave fields empty to keep the saved values."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="client_id" className="input" placeholder="Client ID" autoComplete="off" />
        <input name="client_secret" type="password" className="input" placeholder="Client secret" autoComplete="off" />
        <input name="username" className="input" placeholder="Login email" autoComplete="off" />
        <input name="password" type="password" className="input" placeholder="Password" autoComplete="new-password" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sandbox" defaultChecked={sandbox} className="h-4 w-4" /> Sandbox (testing)
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking with Pathao…">{connected ? "Update Pathao" : "Connect Pathao"}</SubmitButton>
    </form>
  );
}

export function NcmForm({ storeId, branches, current }: { storeId: string; branches: string[]; current: string }) {
  const [state, action] = useActionState(connectNcm.bind(null, storeId), undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-zinc-600">
        Generate a token at <a href="https://portal.nepalcanmove.com/" target="_blank" className="text-indigo-600 underline">portal.nepalcanmove.com</a> → Resources → API Integration.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="token" type="password" className="input" placeholder="API token" autoComplete="off" required />
        <select name="pickup_branch" className="input" defaultValue={current} required>
          <option value="">Pickup branch…</option>
          {branches.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sandbox" className="h-4 w-4" /> Demo server (testing)
      </label>
      <FormMessage state={state} />
      <SubmitButton pendingText="Checking with NCM…">Connect Nepal Can Move</SubmitButton>
    </form>
  );
}
