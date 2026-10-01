"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ColorPicker, ThemePicker } from "@/components/design-inputs";
import { FormMessage, SubmitButton, useKeepValuesSubmit } from "@/components/form";
import { ImageInput } from "@/components/image-input";
import { updateDesign } from "@/lib/actions/store";
import { FONTS, type Store } from "@/lib/types";
import { FONT_CLASS } from "@/lib/storefront";

export function DesignEditor({ store }: { store: Store }) {
  const [state, action, pending] = useActionState(updateDesign.bind(null, store.id), undefined);
  const onSubmit = useKeepValuesSubmit(action);
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    if (state?.ok && frame.current) frame.current.src = `/store/${store.slug}?preview=${Date.now()}`;
  }, [state, store.slug]);

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form onSubmit={onSubmit} className="space-y-6">
        <Section title="Theme & colours">
          <ThemePicker defaultValue={store.theme} />
          <ColorPicker defaultValue={store.primary_color} />
          <div>
            <span className="label">Font</span>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <label key={f} className="flex-1 cursor-pointer">
                  <input type="radio" name="font" value={f} defaultChecked={store.font === f} className="peer sr-only" />
                  <span
                    className={`block rounded-lg border-2 border-zinc-200 px-3 py-2 text-center text-sm capitalize peer-checked:border-indigo-600 peer-checked:bg-indigo-50 ${FONT_CLASS[f]}`}
                  >
                    {f}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Branding">
          <div className="grid grid-cols-2 gap-4">
            <ImageInput name="logo_url" label="Logo" defaultValue={store.logo_url} />
            <ImageInput name="hero_image_url" label="Banner image" defaultValue={store.hero_image_url} />
          </div>
          <Field label="Tagline" name="tagline" defaultValue={store.tagline} placeholder="Handmade in Nepal" />
          <Field
            label="Announcement bar"
            name="announcement"
            defaultValue={store.announcement}
            placeholder="Free delivery inside Kathmandu valley!"
          />
        </Section>

        <Section title="Homepage">
          <Field label="Banner heading" name="hero_title" defaultValue={store.hero_title} />
          <div>
            <label className="label" htmlFor="hero_subtitle">Banner text</label>
            <textarea id="hero_subtitle" name="hero_subtitle" defaultValue={store.hero_subtitle} className="input min-h-20" />
          </div>
          <div>
            <label className="label" htmlFor="about">About your store</label>
            <textarea id="about" name="about" defaultValue={store.about} className="input min-h-28" />
          </div>
          <fieldset className="space-y-2">
            <legend className="label">Sections to show</legend>
            <Toggle name="show_featured" label="Featured products" defaultChecked={!!store.show_featured} />
            <Toggle name="show_categories" label="Shop by category" defaultChecked={!!store.show_categories} />
            <Toggle name="show_about" label="About section" defaultChecked={!!store.show_about} />
          </fieldset>
        </Section>

        <div className="sticky bottom-0 -mx-1 space-y-2 bg-zinc-50/90 px-1 py-3 backdrop-blur">
          <FormMessage state={state} />
          <SubmitButton pending={pending} className="btn-primary w-full">Save & publish design</SubmitButton>
        </div>
      </form>

      <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
        <div className="card flex h-full min-h-[600px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  className={`rounded-md px-2 py-1 capitalize ${device === d ? "bg-white shadow-xs" : "text-zinc-600"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <a href={`/store/${store.slug}`} target="_blank" className="text-xs text-indigo-600 hover:underline">
              Open ↗
            </a>
          </div>
          <div className="flex flex-1 justify-center bg-zinc-100">
            <iframe
              ref={frame}
              src={`/store/${store.slug}`}
              title="Store preview"
              className={`h-full bg-white transition-all ${device === "mobile" ? "w-[390px]" : "w-full"}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} className="input" {...rest} />
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}
