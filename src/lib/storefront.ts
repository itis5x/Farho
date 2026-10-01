import type { FontChoice, Theme } from "./types";

export const FONT_CLASS: Record<FontChoice, string> = {
  sans: "font-sans",
  serif: "font-serif",
  mono: "font-mono",
};

/** Per-theme class names used by the storefront components. */
export const THEME_STYLES: Record<
  Theme,
  { header: string; headerText: string; card: string; image: string; grid: string; button: string; section: string }
> = {
  classic: {
    header: "bg-white border-b border-zinc-200",
    headerText: "text-zinc-900",
    card: "group rounded-lg border border-zinc-200 bg-white overflow-hidden hover:shadow-md transition",
    image: "aspect-square",
    grid: "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4",
    button: "rounded-md",
    section: "bg-zinc-50",
  },
  modern: {
    header: "bg-brand",
    headerText: "text-white",
    card: "group rounded-2xl bg-white shadow-sm overflow-hidden hover:-translate-y-1 hover:shadow-xl transition",
    image: "aspect-[4/5]",
    grid: "grid grid-cols-2 gap-5 md:grid-cols-3",
    button: "rounded-full",
    section: "bg-brand/5",
  },
  minimal: {
    header: "bg-white",
    headerText: "text-zinc-900",
    card: "group bg-white",
    image: "aspect-[3/4]",
    grid: "grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4",
    button: "rounded-none uppercase tracking-widest text-xs",
    section: "bg-white",
  },
};
