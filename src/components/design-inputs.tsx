"use client";

import { useState } from "react";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

const THEME_INFO: Record<Theme, { label: string; description: string }> = {
  classic: { label: "Classic", description: "Big banner, clean product grid." },
  modern: { label: "Modern", description: "Bold colours, rounded cards." },
  minimal: { label: "Minimal", description: "Lots of white space, elegant." },
};

export function ThemePicker({
  defaultValue,
  onChange,
}: {
  defaultValue: Theme;
  onChange?: (t: Theme) => void;
}) {
  const [value, setValue] = useState<Theme>(defaultValue);
  return (
    <fieldset>
      <legend className="label">Theme</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(THEME_INFO) as Theme[]).map((t) => (
          <label
            key={t}
            className={cn(
              "cursor-pointer rounded-xl border-2 p-3 transition",
              value === t ? "border-indigo-600 bg-indigo-50" : "border-zinc-200 hover:border-zinc-300",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={t}
              checked={value === t}
              onChange={() => {
                setValue(t);
                onChange?.(t);
              }}
              className="sr-only"
            />
            <ThemeThumb theme={t} />
            <div className="mt-2 text-sm font-semibold">{THEME_INFO[t].label}</div>
            <div className="text-xs text-zinc-500">{THEME_INFO[t].description}</div>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ThemeThumb({ theme }: { theme: Theme }) {
  if (theme === "modern")
    return (
      <div className="h-16 rounded-lg bg-indigo-600 p-2">
        <div className="h-3 w-1/2 rounded bg-white/80" />
        <div className="mt-2 grid grid-cols-3 gap-1">
          <div className="h-5 rounded-md bg-white/60" />
          <div className="h-5 rounded-md bg-white/60" />
          <div className="h-5 rounded-md bg-white/60" />
        </div>
      </div>
    );
  if (theme === "minimal")
    return (
      <div className="h-16 rounded-lg border border-zinc-200 bg-white p-2">
        <div className="mx-auto h-2 w-1/3 rounded bg-zinc-800" />
        <div className="mt-3 grid grid-cols-4 gap-1">
          <div className="h-5 bg-zinc-100" />
          <div className="h-5 bg-zinc-100" />
          <div className="h-5 bg-zinc-100" />
          <div className="h-5 bg-zinc-100" />
        </div>
      </div>
    );
  return (
    <div className="h-16 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      <div className="h-7 bg-gradient-to-r from-zinc-700 to-zinc-500" />
      <div className="grid grid-cols-3 gap-1 p-1">
        <div className="h-5 rounded bg-zinc-100" />
        <div className="h-5 rounded bg-zinc-100" />
        <div className="h-5 rounded bg-zinc-100" />
      </div>
    </div>
  );
}

const SWATCHES = ["#4f46e5", "#0ea5e9", "#059669", "#d97706", "#dc2626", "#db2777", "#7c3aed", "#18181b"];

export function ColorPicker({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange?: (c: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const set = (c: string) => {
    setValue(c);
    onChange?.(c);
  };
  return (
    <div>
      <span className="label">Brand colour</span>
      <div className="flex flex-wrap items-center gap-2">
        {SWATCHES.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => set(c)}
            aria-label={`Use colour ${c}`}
            className={cn(
              "h-8 w-8 rounded-full ring-offset-2 transition",
              value.toLowerCase() === c ? "ring-2 ring-zinc-900" : "hover:scale-110",
            )}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          name="primary_color"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded border border-zinc-300"
          aria-label="Custom colour"
        />
      </div>
    </div>
  );
}
