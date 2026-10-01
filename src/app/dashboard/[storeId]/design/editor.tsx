"use client";

import { useActionState } from "react";
import { ColorPicker, ThemePicker } from "@/components/design-inputs";
import { FormMessage, SubmitButton, useKeepValuesSubmit } from "@/components/form";
import { ImageInput } from "@/components/image-input";
import { updateDesign } from "@/lib/actions/store";
import { FONT_CLASS } from "@/lib/storefront";
import { FONTS, type Store } from "@/lib/types";

/** Brand & theme settings (the "Brand" tab of the design studio). */
export function BrandForm({ store }: { store: Store }) {
  const [state, action, pending] = useActionState(updateDesign.bind(null, store.id), undefined);
  const onSubmit = useKeepValuesSubmit(action);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Theme & colours</h2>
        <ThemePicker defaultValue={store.theme} />
        <ColorPicker defaultValue={store.primary_color} />
        <div>
          <span className="label">Font</span>
          <div className="flex gap-2">
            {FONTS.map((f) => (
              <label key={f} className="flex-1 cursor-pointer">
                <input type="radio" name="font" value={f} defaultChecked={store.font === f} className="peer sr-only" />
                <span className={`block rounded-lg border-2 border-zinc-200 px-3 py-2 text-center text-sm capitalize peer-checked:border-indigo-600 peer-checked:bg-indigo-50 ${FONT_CLASS[f]}`}>
                  {f}
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>
      <section className="card space-y-4 p-4">
        <h2 className="font-semibold">Branding</h2>
        <div className="max-w-40">
          <ImageInput name="logo_url" label="Logo" defaultValue={store.logo_url} />
        </div>
        <label className="block">
          <span className="label">Tagline</span>
          <input name="tagline" defaultValue={store.tagline} className="input" placeholder="Handmade in Nepal" />
        </label>
        <label className="block">
          <span className="label">Announcement bar</span>
          <input name="announcement" defaultValue={store.announcement} className="input" placeholder="Free delivery inside Kathmandu valley!" />
        </label>
        <label className="block">
          <span className="label">About your store (used by the assistant and search engines)</span>
          <textarea name="about" defaultValue={store.about} className="input min-h-24" />
        </label>
      </section>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="btn-primary w-full">Save brand</SubmitButton>
    </form>
  );
}
