"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { updateSettings } from "@/lib/actions/store";
import type { Store } from "@/lib/types";

export function SettingsForm({ store }: { store: Store }) {
  const [state, action] = useActionState(updateSettings.bind(null, store.id), undefined);
  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">General</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="name">Store name</label>
            <input id="name" name="name" defaultValue={store.name} className="input" required />
          </div>
          <div>
            <label className="label" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue={store.currency} className="input">
              <option value="NPR">Nepali Rupee (Rs.)</option>
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
            </select>
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
          <input type="checkbox" name="published" defaultChecked={!!store.published} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="font-medium">Store is published</span>
            <span className="block text-zinc-500">When unpublished, visitors see a “coming soon” page and can&apos;t order.</span>
          </span>
        </label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Delivery</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="delivery_charge">Delivery charge</label>
            <input id="delivery_charge" name="delivery_charge" type="number" min="0" step="0.01" defaultValue={store.delivery_charge} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="free_delivery_over">
              Free delivery over <span className="font-normal text-zinc-400">(0 = never)</span>
            </label>
            <input id="free_delivery_over" name="free_delivery_over" type="number" min="0" step="0.01" defaultValue={store.free_delivery_over} className="input" />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Contact & social</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input name="contact_phone" label="Phone" defaultValue={store.contact_phone} />
          <Input name="contact_email" label="Email" type="email" defaultValue={store.contact_email} />
          <div className="sm:col-span-2">
            <Input name="address" label="Address" defaultValue={store.address} />
          </div>
          <Input name="facebook_url" label="Facebook URL" defaultValue={store.facebook_url} />
          <Input name="instagram_url" label="Instagram URL" defaultValue={store.instagram_url} />
          <Input name="tiktok_url" label="TikTok URL" defaultValue={store.tiktok_url} />
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton>Save settings</SubmitButton>
    </form>
  );
}

function Input({ name, label, ...rest }: { name: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}
