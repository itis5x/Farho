"use client";

import { useMemo, useState, useTransition } from "react";
import { uploadBuilderImage } from "@/lib/actions/builder";
import type { ProductOption, Variant } from "@/lib/types";

type Row = { title: string; option1: string; option2: string; option3: string; price: number | null; stock: number | null; sku: string; image_url: string };

function combos(options: ProductOption[]): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((c) => o.values.map((v) => [...c, v])), [[]]);
}

/** Options (Size, Colour…) and the price/stock of every combination. Writes hidden JSON inputs for the form. */
export function VariantsEditor({ initialOptions, initialVariants, currency }: { initialOptions: ProductOption[]; initialVariants: Variant[]; currency: string }) {
  const [options, setOptions] = useState<ProductOption[]>(initialOptions);
  const [drafts, setDrafts] = useState<Record<number, string>>(Object.fromEntries(initialOptions.map((o, i) => [i, o.values.join(", ")])));
  const [rows, setRows] = useState<Record<string, Row>>(
    Object.fromEntries(initialVariants.map((v) => [v.title, { title: v.title, option1: v.option1, option2: v.option2, option3: v.option3, price: v.price, stock: v.stock, sku: v.sku, image_url: v.image_url }])),
  );

  const clean = options.filter((o) => o.name.trim() && o.values.length);
  const variants: Row[] = useMemo(
    () =>
      clean.length
        ? combos(clean).map((c) => {
            const title = c.join(" / ");
            return rows[title] ?? { title, option1: c[0] ?? "", option2: c[1] ?? "", option3: c[2] ?? "", price: null, stock: null, sku: "", image_url: "" };
          })
        : [],
    [clean, rows],
  );

  const setRow = (title: string, patch: Partial<Row>) =>
    setRows((r) => ({ ...r, [title]: { ...(variants.find((v) => v.title === title) as Row), ...r[title], ...patch } }));

  return (
    <div className="card space-y-4 p-5">
      <input type="hidden" name="options_json" value={JSON.stringify(clean)} />
      <input type="hidden" name="variants_json" value={JSON.stringify(variants)} />
      <div>
        <h3 className="font-semibold">Variants</h3>
        <p className="text-sm text-zinc-600">Does this product come in sizes, colours or styles? Each combination gets its own price and stock.</p>
      </div>
      {options.map((o, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
          <input
            value={o.name}
            onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            className="input"
            placeholder="Size"
            aria-label="Option name"
          />
          <input
            value={drafts[i] ?? ""}
            onChange={(e) => {
              setDrafts({ ...drafts, [i]: e.target.value });
              const values = [...new Set(e.target.value.split(",").map((v) => v.trim()).filter(Boolean))];
              setOptions(options.map((x, j) => (j === i ? { ...x, values } : x)));
            }}
            className="input"
            placeholder="S, M, L, XL"
            aria-label="Option values, comma separated"
          />
          <button
            type="button"
            onClick={() => {
              setOptions(options.filter((_, j) => j !== i));
              setDrafts(Object.fromEntries(Object.entries(drafts).filter(([k]) => Number(k) !== i).map(([, v], n) => [n, v])));
            }}
            className="btn-secondary px-3 text-rose-600"
            aria-label="Remove option"
          >
            ×
          </button>
        </div>
      ))}
      {options.length < 3 && (
        <button type="button" onClick={() => setOptions([...options, { name: options.length === 0 ? "Size" : options.length === 1 ? "Colour" : "Style", values: [] }])} className="text-sm font-medium text-indigo-600">
          + Add option ({options.length === 0 ? "e.g. Size" : options.length === 1 ? "e.g. Colour" : "e.g. Material"})
        </button>
      )}
      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-2 pr-2">Variant</th>
                <th className="py-2 pr-2">Price ({currency})</th>
                <th className="py-2 pr-2">Stock</th>
                <th className="py-2">SKU</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {variants.map((v) => (
                <tr key={v.title}>
                  <td className="py-2 pr-2 font-medium">{v.title}</td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.price ?? ""}
                      placeholder="Same"
                      onChange={(e) => setRow(v.title, { price: e.target.value === "" ? null : Number(e.target.value) })}
                      className="input w-28 py-1"
                      aria-label={`Price for ${v.title}`}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={v.stock ?? ""}
                      placeholder="∞"
                      onChange={(e) => setRow(v.title, { stock: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))) })}
                      className="input w-24 py-1"
                      aria-label={`Stock for ${v.title}`}
                    />
                  </td>
                  <td className="py-2">
                    <input value={v.sku} onChange={(e) => setRow(v.title, { sku: e.target.value })} className="input w-32 py-1" aria-label={`SKU for ${v.title}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">Leave price empty to use the main price. Leave stock empty for unlimited.</p>
        </div>
      )}
    </div>
  );
}

/** Extra product photos (the main photo is separate). */
export function GalleryEditor({ storeId, initial }: { storeId: string; initial: string[] }) {
  const [images, setImages] = useState<string[]>(initial);
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="card space-y-3 p-5">
      <input type="hidden" name="images_json" value={JSON.stringify(images)} />
      <h3 className="font-semibold">More photos</h3>
      <div className="grid grid-cols-4 gap-2">
        {images.map((src, i) => (
          <div key={src + i} className="group relative aspect-square overflow-hidden rounded-md bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 text-xs text-white group-hover:block" aria-label="Remove photo">
              ×
            </button>
          </div>
        ))}
        {images.length < 10 && (
          <label className="grid aspect-square cursor-pointer place-items-center rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-indigo-400">
            {busy ? "Uploading…" : "+ Add"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="sr-only"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 10 - images.length);
                setError("");
                start(async () => {
                  for (const f of files) {
                    const fd = new FormData();
                    fd.set("image_file", f);
                    const res = await uploadBuilderImage(storeId, fd);
                    if (res.url) setImages((cur) => [...cur, res.url!]);
                    else setError(res.error ?? "Upload failed");
                  }
                });
              }}
            />
          </label>
        )}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
