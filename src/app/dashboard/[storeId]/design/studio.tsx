"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { applyTemplate, saveLayout, uploadBuilderImage } from "@/lib/actions/builder";
import { blankSection, newId, SECTION_INFO, type Layout, type Section, type SectionType, type StorePage } from "@/lib/builder/schema";
import type { Template } from "@/lib/builder/templates";
import type { Category, Store } from "@/lib/types";
import { cn, slugify } from "@/lib/utils";

type Tab = "sections" | "templates" | "pages" | "code" | "brand";
type TemplateCard = Pick<Template, "id" | "name" | "description" | "preview" | "theme" | "primary_color" | "font">;

export function DesignStudio({
  store,
  initial,
  categories,
  templates,
  brandForm,
}: {
  store: Store;
  initial: Layout;
  categories: Category[];
  templates: TemplateCard[];
  brandForm: React.ReactNode;
}) {
  const router = useRouter();
  const [layout, setLayout] = useState<Layout>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [tab, setTab] = useState<Tab>("sections");
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok?: string; error?: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = JSON.stringify(layout) !== saved;

  // A template applied on the server replaces the layout.
  useEffect(() => {
    setLayout(initial);
    setSaved(JSON.stringify(initial));
  }, [initial]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const reloadPreview = () => {
    if (frame.current) frame.current.src = `/store/${store.slug}?preview=${Date.now()}`;
  };

  const publish = () =>
    startSaving(async () => {
      const json = JSON.stringify(layout);
      const res = await saveLayout(store.id, json);
      setMessage(res ?? null);
      if (res?.ok) {
        setSaved(json);
        reloadPreview();
      }
    });

  const update = (id: string, patch: Partial<Section>) =>
    setLayout((l) => ({ ...l, sections: l.sections.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)) }));
  const move = (i: number, dir: -1 | 1) =>
    setLayout((l) => {
      const next = [...l.sections];
      const j = i + dir;
      if (j < 0 || j >= next.length) return l;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...l, sections: next };
    });
  const remove = (id: string) => setLayout((l) => ({ ...l, sections: l.sections.filter((s) => s.id !== id) }));
  const duplicate = (i: number) =>
    setLayout((l) => {
      const next = [...l.sections];
      next.splice(i + 1, 0, { ...structuredClone(next[i]), id: newId() });
      return { ...l, sections: next };
    });
  const add = (type: SectionType) => {
    const s = blankSection(type);
    setLayout((l) => ({ ...l, sections: [...l.sections, s] }));
    setOpen(s.id);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[460px_1fr]">
      <div className="space-y-4">
        <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-zinc-50/95 px-1 py-2 backdrop-blur">
          <div className="flex flex-1 gap-1 overflow-x-auto rounded-lg bg-white p-1 text-sm shadow-xs ring-1 ring-zinc-200">
            {(
              [
                ["sections", "Sections"],
                ["templates", "Templates"],
                ["pages", "Pages"],
                ["brand", "Brand"],
                ["code", "Code"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTab(v)}
                className={cn("shrink-0 rounded-md px-3 py-1.5 font-medium", tab === v ? "bg-indigo-600 text-white" : "text-zinc-600 hover:bg-zinc-100")}
              >
                {label}
              </button>
            ))}
          </div>
          {tab !== "brand" && tab !== "templates" && (
            <button type="button" onClick={publish} disabled={saving || !dirty} className="btn-primary shrink-0">
              {saving ? "Publishing…" : dirty ? "Publish" : "Published ✓"}
            </button>
          )}
        </div>
        {message && (
          <p className={cn("rounded-lg px-3 py-2 text-sm", message.error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700")}>
            {message.error ?? message.ok}
          </p>
        )}

        {tab === "sections" && (
          <div className="space-y-2">
            {layout.sections.map((s, i) => (
              <div key={s.id} className={cn("card overflow-hidden", s.hidden && "opacity-60")}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="flex flex-1 items-center gap-2 text-left">
                    <span className="text-lg">{SECTION_INFO[s.type].icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{SECTION_INFO[s.type].label}</span>
                      <span className="block truncate text-xs text-zinc-500">{"title" in s && s.title ? s.title : SECTION_INFO[s.type].description}</span>
                    </span>
                  </button>
                  <IconButton label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>↑</IconButton>
                  <IconButton label="Move down" onClick={() => move(i, 1)} disabled={i === layout.sections.length - 1}>↓</IconButton>
                  <IconButton label={s.hidden ? "Show" : "Hide"} onClick={() => update(s.id, { hidden: !s.hidden })}>{s.hidden ? "🙈" : "👁"}</IconButton>
                  <IconButton label="Duplicate" onClick={() => duplicate(i)}>⧉</IconButton>
                  <IconButton label="Delete" onClick={() => confirm("Delete this section?") && remove(s.id)}>🗑</IconButton>
                </div>
                {open === s.id && (
                  <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/50 p-3">
                    <SectionEditor storeId={store.id} section={s} categories={categories} onChange={(patch) => update(s.id, patch)} />
                  </div>
                )}
              </div>
            ))}
            <AddSection onAdd={add} />
          </div>
        )}

        {tab === "templates" && <Templates storeId={store.id} templates={templates} onApplied={() => router.refresh()} />}

        {tab === "pages" && <PagesEditor pages={layout.pages} onChange={(pages) => setLayout((l) => ({ ...l, pages }))} storeSlug={store.slug} />}

        {tab === "code" && (
          <div className="card space-y-3 p-4">
            <div>
              <h3 className="font-semibold">Custom CSS</h3>
              <p className="text-sm text-zinc-600">
                Style anything on your store. Your brand colour is available as <code>var(--brand)</code>. For custom HTML/JS, add a <em>Custom code</em> section.
              </p>
            </div>
            <textarea
              value={layout.custom_css}
              onChange={(e) => setLayout((l) => ({ ...l, custom_css: e.target.value }))}
              spellCheck={false}
              className="input min-h-80 font-mono text-xs"
              placeholder={"/* Example */\nh1 { letter-spacing: -0.02em; }\n.rounded-2xl { border-radius: 4px; }"}
            />
          </div>
        )}

        {tab === "brand" && brandForm}
      </div>

      <div className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
        <div className="card flex h-full min-h-[600px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2">
            <span className="text-xs text-zinc-500">{dirty ? "Preview shows your last published version" : "Live preview"}</span>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs">
              {(["desktop", "mobile"] as const).map((d) => (
                <button key={d} type="button" onClick={() => setDevice(d)} className={cn("rounded-md px-2 py-1 capitalize", device === d ? "bg-white shadow-xs" : "text-zinc-600")}>
                  {d}
                </button>
              ))}
            </div>
            <a href={`/store/${store.slug}`} target="_blank" className="text-xs text-indigo-600 hover:underline">
              Open ↗
            </a>
          </div>
          <div className="flex flex-1 justify-center bg-zinc-100">
            <iframe ref={frame} src={`/store/${store.slug}`} title="Store preview" className={cn("h-full bg-white transition-all", device === "mobile" ? "w-[390px]" : "w-full")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="grid h-7 w-7 place-items-center rounded-md text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">
      {children}
    </button>
  );
}

function AddSection({ onAdd }: { onAdd: (t: SectionType) => void }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl border-2 border-dashed border-zinc-300 py-3 text-sm font-medium text-zinc-600 hover:border-indigo-400 hover:text-indigo-600">
        + Add section
      </button>
    );
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Add a section</span>
        <button type="button" onClick={() => setOpen(false)} className="text-zinc-400">×</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(SECTION_INFO) as SectionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              onAdd(t);
              setOpen(false);
            }}
            className="rounded-lg border border-zinc-200 p-2 text-left hover:border-indigo-400 hover:bg-indigo-50"
          >
            <span className="text-lg">{SECTION_INFO[t].icon}</span>
            <span className="block text-sm font-medium">{SECTION_INFO[t].label}</span>
            <span className="block text-xs text-zinc-500">{SECTION_INFO[t].description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Field helpers ----------------------------- */

function Field({ label, value, onChange, placeholder, area, rows = 3, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; area?: boolean; rows?: number; mono?: boolean }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {area ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} spellCheck={!mono} className={cn("input", mono && "font-mono text-xs")} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" />
      )}
    </label>
  );
}

function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="input">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

function ImageField({ storeId, label, value, onChange }: { storeId: string; label: string; value: string; onChange: (v: string) => void }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-200">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex gap-2">
            <label className="btn-secondary cursor-pointer px-3 py-1 text-xs">
              {busy ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const fd = new FormData();
                  fd.set("image_file", file);
                  setError("");
                  start(async () => {
                    const res = await uploadBuilderImage(storeId, fd);
                    if (res.url) onChange(res.url);
                    else setError(res.error ?? "Upload failed");
                  });
                }}
              />
            </label>
            {value && (
              <button type="button" onClick={() => onChange("")} className="btn-secondary px-3 py-1 text-xs">Remove</button>
            )}
          </div>
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="…or paste an image URL" className="input py-1 text-xs" />
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}

function ButtonFields({ text, link, onChange }: { text: string; link: string; onChange: (p: { button_text?: string; button_link?: string }) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Button text" value={text} onChange={(v) => onChange({ button_text: v })} />
      <Field label="Button link" value={link} onChange={(v) => onChange({ button_link: v })} placeholder="/products" />
    </div>
  );
}

function ListEditor<T>({ items, onChange, blank, render, addLabel }: { items: T[]; onChange: (items: T[]) => void; blank: T; render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode; addLabel: string }) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="relative space-y-2 rounded-lg border border-zinc-200 bg-white p-2 pr-8">
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="absolute right-2 top-2 text-zinc-400 hover:text-rose-600" aria-label="Remove">
            ×
          </button>
          {render(item, (patch) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it))))}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, structuredClone(blank)])} className="text-sm font-medium text-indigo-600">
        + {addLabel}
      </button>
    </div>
  );
}

/* ----------------------------- Section editors ---------------------------- */

function SectionEditor({ storeId, section: s, categories, onChange }: { storeId: string; section: Section; categories: Category[]; onChange: (patch: Partial<Section>) => void }) {
  const set = onChange as (patch: Record<string, unknown>) => void;
  switch (s.type) {
    case "hero":
      return (
        <>
          <Select label="Style" value={s.style} options={[["overlay", "Photo with text on top"], ["split", "Text + photo side by side"], ["centered", "Centered, minimal"], ["gradient", "Colour gradient"]]} onChange={(v) => set({ style: v })} />
          <Field label="Headline" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="Text" value={s.subtitle} onChange={(v) => set({ subtitle: v })} area rows={2} />
          {s.style !== "gradient" && <ImageField storeId={storeId} label="Image" value={s.image} onChange={(v) => set({ image: v })} />}
          <ButtonFields text={s.button_text} link={s.button_link} onChange={set} />
        </>
      );
    case "products":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Show" value={s.source} options={[["newest", "Newest"], ["featured", "Featured"], ["sale", "On sale"], ["category", "A category"]]} onChange={(v) => set({ source: v })} />
            <Select label="Layout" value={s.layout} options={[["grid", "Grid"], ["carousel", "Swipe carousel"]]} onChange={(v) => set({ layout: v })} />
          </div>
          {s.source === "category" && (
            <Select label="Category" value={s.category_id} options={[["", "Choose…"], ...categories.map((c) => [c.id, c.name] as [string, string])]} onChange={(v) => set({ category_id: v })} />
          )}
          <label className="block">
            <span className="label">How many ({s.limit})</span>
            <input type="range" min={1} max={24} value={s.limit} onChange={(e) => set({ limit: Number(e.target.value) })} className="w-full" />
          </label>
        </>
      );
    case "categories":
      return <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />;
    case "banner":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="Text" value={s.text} onChange={(v) => set({ text: v })} />
          <Select label="Colour" value={s.tone} options={[["brand", "Brand colour"], ["dark", "Dark"], ["light", "Light"]]} onChange={(v) => set({ tone: v })} />
          <ImageField storeId={storeId} label="Background image (optional)" value={s.image} onChange={(v) => set({ image: v })} />
          <ButtonFields text={s.button_text} link={s.button_link} onChange={set} />
        </>
      );
    case "image_text":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="Text" value={s.text} onChange={(v) => set({ text: v })} area rows={5} />
          <ImageField storeId={storeId} label="Image" value={s.image} onChange={(v) => set({ image: v })} />
          <Select label="Image on the" value={s.image_side} options={[["left", "Left"], ["right", "Right"]]} onChange={(v) => set({ image_side: v })} />
          <ButtonFields text={s.button_text} link={s.button_link} onChange={set} />
        </>
      );
    case "text":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="Text" value={s.text} onChange={(v) => set({ text: v })} area rows={6} />
          <Select label="Alignment" value={s.align} options={[["center", "Centered"], ["left", "Left"]]} onChange={(v) => set({ align: v })} />
        </>
      );
    case "perks":
      return (
        <ListEditor
          items={s.items}
          onChange={(items) => set({ items })}
          blank={{ icon: "⭐", title: "", text: "" }}
          addLabel="Add perk"
          render={(it, up) => (
            <div className="grid grid-cols-[60px_1fr] gap-2">
              <input value={it.icon} onChange={(e) => up({ icon: e.target.value })} className="input text-center" aria-label="Icon (emoji)" />
              <input value={it.title} onChange={(e) => up({ title: e.target.value })} className="input" placeholder="Title" />
              <span />
              <input value={it.text} onChange={(e) => up({ text: e.target.value })} className="input" placeholder="Short text" />
            </div>
          )}
        />
      );
    case "testimonials":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <ListEditor
            items={s.items}
            onChange={(items) => set({ items })}
            blank={{ name: "", text: "", rating: 5 }}
            addLabel="Add testimonial"
            render={(it, up) => (
              <>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <input value={it.name} onChange={(e) => up({ name: e.target.value })} className="input" placeholder="Name" />
                  <select value={it.rating} onChange={(e) => up({ rating: Number(e.target.value) })} className="input">
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>{"★".repeat(r)}</option>
                    ))}
                  </select>
                </div>
                <textarea value={it.text} onChange={(e) => up({ text: e.target.value })} className="input" rows={2} placeholder="What they said" />
              </>
            )}
          />
        </>
      );
    case "faq":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <ListEditor
            items={s.items}
            onChange={(items) => set({ items })}
            blank={{ q: "", a: "" }}
            addLabel="Add question"
            render={(it, up) => (
              <>
                <input value={it.q} onChange={(e) => up({ q: e.target.value })} className="input" placeholder="Question" />
                <textarea value={it.a} onChange={(e) => up({ a: e.target.value })} className="input" rows={2} placeholder="Answer" />
              </>
            )}
          />
        </>
      );
    case "video":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="YouTube link" value={s.url} onChange={(v) => set({ url: v })} placeholder="https://www.youtube.com/watch?v=…" />
        </>
      );
    case "gallery":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <ListEditor items={s.images} onChange={(images) => set({ images })} blank="" addLabel="Add photo" render={(src, up) => <ImageField storeId={storeId} label="Photo" value={src} onChange={(v) => up(v as never)} />} />
        </>
      );
    case "countdown":
      return (
        <>
          <Field label="Title" value={s.title} onChange={(v) => set({ title: v })} />
          <Field label="Text" value={s.text} onChange={(v) => set({ text: v })} />
          <label className="block">
            <span className="label">Ends at</span>
            <input type="datetime-local" value={s.ends_at.slice(0, 16)} onChange={(e) => set({ ends_at: e.target.value })} className="input" />
          </label>
          <ButtonFields text={s.button_text} link={s.button_link} onChange={set} />
        </>
      );
    case "html":
      return (
        <>
          <p className="text-xs text-zinc-600">
            Write any HTML, CSS and JavaScript. It runs in a sandbox, so it can&apos;t affect checkout or customer data.
          </p>
          <Field label="Code" value={s.html} onChange={(v) => set({ html: v })} area rows={10} mono />
          <label className="block">
            <span className="label">Height ({s.height}px)</span>
            <input type="range" min={50} max={1200} step={10} value={s.height} onChange={(e) => set({ height: Number(e.target.value) })} className="w-full" />
          </label>
        </>
      );
    case "spacer":
      return <Select label="Size" value={s.size} options={[["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]} onChange={(v) => set({ size: v })} />;
  }
}

/* -------------------------------- Templates ------------------------------- */

function Templates({ storeId, templates, onApplied }: { storeId: string; templates: TemplateCard[]; onApplied: () => void }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Pick a starting design. It replaces your homepage sections and colours — your products, pages and settings stay.
      </p>
      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</p>}
      <div className="grid grid-cols-2 gap-3">
        {templates.map((t) => (
          <div key={t.id} className="card overflow-hidden">
            <div className="h-24 p-3" style={{ background: `linear-gradient(135deg, ${t.preview[0]}, ${t.preview[1]})` }}>
              <div className={cn("text-lg font-bold", t.font === "serif" ? "font-serif" : t.font === "mono" ? "font-mono" : "font-sans")} style={{ color: t.preview[0] === "#111111" || t.preview[0].startsWith("#0") ? "#fff" : "#111" }}>
                {t.name}
              </div>
            </div>
            <div className="space-y-2 p-3">
              <p className="text-xs text-zinc-600">{t.description}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  confirm(`Apply the “${t.name}” template? Your current homepage sections will be replaced.`) &&
                  start(async () => {
                    const res = await applyTemplate(storeId, t.id);
                    setMsg(res?.ok ?? res?.error ?? "");
                    onApplied();
                  })
                }
                className="btn-secondary w-full py-1.5 text-xs"
              >
                {busy ? "Applying…" : "Use this template"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- Pages --------------------------------- */

function PagesEditor({ pages, onChange, storeSlug }: { pages: StorePage[]; onChange: (p: StorePage[]) => void; storeSlug: string }) {
  const suggestions = useMemo(
    () => [
      { title: "About us", body: "Tell your story here." },
      { title: "Return policy", body: "Items can be exchanged within 7 days of delivery if unused and with tags." },
      { title: "Contact", body: "Call or WhatsApp us any time.\n\nAddress: …" },
      { title: "Shipping", body: "Inside Kathmandu valley: 1–2 days.\nOutside the valley: 3–5 days." },
    ],
    [],
  );
  const addPage = (title: string, body = "") => {
    let slug = slugify(title) || "page";
    while (pages.some((p) => p.slug === slug)) slug = `${slug}-2`;
    onChange([...pages, { title, slug, body, in_menu: true }]);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">Extra pages show in your footer (and the first three in the top menu).</p>
      {pages.map((p, i) => {
        const set = (patch: Partial<StorePage>) => onChange(pages.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <div key={i} className="card space-y-2 p-3">
            <div className="flex gap-2">
              <input value={p.title} onChange={(e) => set({ title: e.target.value })} className="input font-medium" placeholder="Page title" />
              <button type="button" onClick={() => confirm("Delete this page?") && onChange(pages.filter((_, j) => j !== i))} className="btn-secondary px-3 text-rose-600">🗑</button>
            </div>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              /store/{storeSlug}/pages/
              <input value={p.slug} onChange={(e) => set({ slug: slugify(e.target.value) })} className="input w-40 py-1 text-xs" />
            </div>
            <textarea value={p.body} onChange={(e) => set({ body: e.target.value })} rows={6} className="input" placeholder="Page content. Leave a blank line between paragraphs." />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={p.in_menu} onChange={(e) => set({ in_menu: e.target.checked })} /> Show in top menu
            </label>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {suggestions
          .filter((s) => !pages.some((p) => p.title === s.title))
          .map((s) => (
            <button key={s.title} type="button" onClick={() => addPage(s.title, s.body)} className="btn-secondary px-3 py-1.5 text-xs">
              + {s.title}
            </button>
          ))}
        <button type="button" onClick={() => addPage("New page")} className="btn-secondary px-3 py-1.5 text-xs">+ Blank page</button>
      </div>
    </div>
  );
}
