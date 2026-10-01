"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { ThemePicker, ColorPicker } from "@/components/design-inputs";
import { createStore } from "@/lib/actions/store";
import { slugify } from "@/lib/utils";

export function CreateStoreForm() {
  const [state, action] = useActionState(createStore, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const effectiveSlug = slugTouched ? slug : slugify(name);

  return (
    <form action={action} className="mt-6 space-y-5">
      <div>
        <label className="label" htmlFor="name">Store name</label>
        <input
          className="input"
          id="name"
          name="name"
          required
          placeholder="e.g. Himalayan Threads"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="slug">Store address</label>
        <div className="flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <span className="bg-zinc-50 px-3 py-2 text-sm text-zinc-500">farho/store/</span>
          <input
            id="slug"
            name="slug"
            className="w-full px-2 py-2 text-sm outline-none"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            placeholder="himalayan-threads"
            required
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="tagline">Tagline <span className="font-normal text-zinc-400">(optional)</span></label>
        <input className="input" id="tagline" name="tagline" placeholder="Handmade clothing from Nepal" />
      </div>
      <ThemePicker defaultValue="classic" />
      <ColorPicker defaultValue="#4f46e5" />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3" pendingText="Creating your store…">
        Create store
      </SubmitButton>
    </form>
  );
}
