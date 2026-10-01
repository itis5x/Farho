"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton, useKeepValuesSubmit } from "@/components/form";
import { ImageInput } from "@/components/image-input";
import { savePayments } from "@/lib/actions/payments";
import type { GatewayMode, PaymentSettings } from "@/lib/payments/settings";
import { cn } from "@/lib/utils";

type Own = {
  esewa: { code: string; secret: string; live: boolean } | null;
  khalti: { secret: string; live: boolean } | null;
};

export function PaymentsForm({
  storeId,
  settings,
  own,
  farho,
}: {
  storeId: string;
  settings: PaymentSettings;
  own: Own;
  farho: { khaltiAvailable: boolean; esewaLive: boolean };
}) {
  const [state, action, pending] = useActionState(savePayments.bind(null, storeId), undefined);
  const onSubmit = useKeepValuesSubmit(action);
  const [esewaMode, setEsewaMode] = useState<GatewayMode>(settings.esewa.mode);
  const [khaltiMode, setKhaltiMode] = useState<GatewayMode>(settings.khalti.mode);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Method name="cod_enabled" title="Cash on delivery" logo={["bg-zinc-800", "💵"]} enabled={settings.cod.enabled}>
        <Field label="Label shown at checkout" name="cod_label" defaultValue={settings.cod.label} />
      </Method>

      <Method name="esewa_enabled" title="eSewa" logo={["bg-[#60bb46]", "e"]} enabled={settings.esewa.enabled}>
        <ModePicker name="esewa_mode" value={esewaMode} onChange={setEsewaMode} />
        {esewaMode === "farho" ? (
          <p className="text-sm text-zinc-600">
            {farho.esewaLive
              ? "Payments go through Farho's eSewa merchant account and are paid out to you."
              : "Farho Pay is in eSewa test mode — payments use eSewa's sandbox, so no real money moves yet."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Merchant (product) code" name="esewa_product_code" placeholder={own.esewa?.code ?? "EPAYTEST"} />
            <Field label="Secret key" name="esewa_secret_key" type="password" placeholder={own.esewa?.secret ?? ""} />
            <Toggle name="esewa_live" label="Live mode (real payments)" defaultChecked={own.esewa?.live ?? false} />
            {own.esewa && <Toggle name="esewa_clear" label="Remove saved credentials" />}
          </div>
        )}
      </Method>

      <Method name="khalti_enabled" title="Khalti" logo={["bg-[#5c2d91]", "K"]} enabled={settings.khalti.enabled}>
        <ModePicker name="khalti_mode" value={khaltiMode} onChange={setKhaltiMode} />
        {khaltiMode === "farho" ? (
          <p className="text-sm text-zinc-600">
            {farho.khaltiAvailable
              ? "Payments go through Farho's Khalti merchant account and are paid out to you."
              : "Farho Pay for Khalti is being set up — until then Khalti won't show at checkout in this mode. Use your own key to start now."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Live secret key" name="khalti_secret_key" type="password" placeholder={own.khalti?.secret ?? "From admin.khalti.com"} />
            <Toggle name="khalti_live" label="Live mode (real payments)" defaultChecked={own.khalti?.live ?? false} />
            {own.khalti && <Toggle name="khalti_clear" label="Remove saved key" />}
          </div>
        )}
      </Method>

      <Method name="qr_enabled" title="QR payment (Fonepay, eSewa, Khalti or bank QR)" logo={["bg-[#d71e28]", "QR"]} enabled={settings.qr.enabled}>
        <p className="text-sm text-zinc-600">
          Customers scan your QR, pay, and type the transaction ID. You confirm the payment from the order page. No fees.
        </p>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <ImageInput name="qr_image" label="Your QR code" defaultValue={settings.qr.image_url} />
          <div className="space-y-3">
            <Field label="Label at checkout" name="qr_label" defaultValue={settings.qr.label} />
            <div>
              <label className="label" htmlFor="qr_instructions">Instructions</label>
              <textarea id="qr_instructions" name="qr_instructions" defaultValue={settings.qr.instructions} className="input min-h-20" placeholder="Account name: … Please write your phone number in remarks." />
            </div>
          </div>
        </div>
      </Method>

      <Method name="bank_enabled" title="Bank transfer" logo={["bg-sky-700", "🏦"]} enabled={settings.bank.enabled}>
        <label className="label" htmlFor="bank_details">Bank account details</label>
        <textarea
          id="bank_details"
          name="bank_details"
          defaultValue={settings.bank.details}
          className="input min-h-24 font-mono"
          placeholder={"Bank: Nabil Bank\nAccount name: …\nAccount number: …\nBranch: …"}
        />
      </Method>

      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save payment settings</SubmitButton>
    </form>
  );
}

function Method({
  name,
  title,
  logo,
  enabled,
  children,
}: {
  name: string;
  title: string;
  logo: [string, string];
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <section className={cn("card overflow-hidden transition", on && "ring-2 ring-indigo-500/30")}>
      <label className="flex cursor-pointer items-center gap-3 px-5 py-4">
        <span className={cn("grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white", logo[0])}>{logo[1]}</span>
        <span className="flex-1 font-semibold">{title}</span>
        <input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
        <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition peer-checked:bg-indigo-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
      </label>
      <div className={cn("space-y-3 border-t border-zinc-100 px-5 py-4", !on && "hidden")}>{children}</div>
    </section>
  );
}

function ModePicker({ name, value, onChange }: { name: string; value: GatewayMode; onChange: (m: GatewayMode) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(
        [
          ["farho", "Farho Pay", "No merchant account needed. We collect and pay out to you."],
          ["own", "My own merchant account", "Money goes straight to your account. No Farho fee."],
        ] as const
      ).map(([v, title, desc]) => (
        <label
          key={v}
          className={cn("cursor-pointer rounded-lg border-2 p-3 text-sm", value === v ? "border-indigo-600 bg-indigo-50" : "border-zinc-200")}
        >
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
          <span className="font-semibold">{title}</span>
          <span className="block text-zinc-600">{desc}</span>
        </label>
      ))}
    </div>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} className="input" autoComplete="off" {...rest} />
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
