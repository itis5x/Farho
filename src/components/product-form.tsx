"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { ImageInput } from "@/components/image-input";
import { saveProduct } from "@/lib/actions/catalog";
import type { Category, Product, ProductOption, Variant } from "@/lib/types";
import { GalleryEditor, VariantsEditor } from "./variants-editor";

export function ProductForm({
  storeId,
  product,
  categories,
  currency,
  options = [],
  variants = [],
  images = [],
}: {
  storeId: string;
  product?: Product;
  categories: Category[];
  currency: string;
  options?: ProductOption[];
  variants?: Variant[];
  images?: string[];
}) {
  const [state, action] = useActionState(saveProduct.bind(null, storeId, product?.id ?? null), undefined);
  return (
    <form action={action} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required defaultValue={product?.name} placeholder="Pashmina shawl" />
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea
              className="input min-h-36"
              id="description"
              name="description"
              defaultValue={product?.description}
              placeholder="Tell customers about this product…"
            />
          </div>
        </div>
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price">Price ({currency})</label>
            <input className="input" id="price" name="price" type="number" step="0.01" min="0" required defaultValue={product?.price} />
          </div>
          <div>
            <label className="label" htmlFor="compare_at_price">
              Compare-at price <span className="font-normal text-zinc-400">(shows as discount)</span>
            </label>
            <input
              className="input"
              id="compare_at_price"
              name="compare_at_price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.compare_at_price ?? ""}
            />
          </div>
          <div>
            <label className="label" htmlFor="stock">
              Stock quantity <span className="font-normal text-zinc-400">(blank = unlimited)</span>
            </label>
            <input className="input" id="stock" name="stock" type="number" min="0" step="1" defaultValue={product?.stock ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="sku">SKU</label>
            <input className="input" id="sku" name="sku" defaultValue={product?.sku} />
          </div>
          <div>
            <label className="label" htmlFor="cost_price">
              Cost price <span className="font-normal text-zinc-400">(private — for profit reports)</span>
            </label>
            <input className="input" id="cost_price" name="cost_price" type="number" step="0.01" min="0" defaultValue={product?.cost_price ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="barcode">Barcode</label>
            <input className="input" id="barcode" name="barcode" defaultValue={product?.barcode} placeholder="Scan or type" />
          </div>
        </div>
        <VariantsEditor initialOptions={options} initialVariants={variants} currency={currency} />
      </div>
      <div className="space-y-6">
        <div className="card space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={product ? !!product.active : true} className="h-4 w-4" />
            Visible on website
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="featured" defaultChecked={!!product?.featured} className="h-4 w-4" />
            Featured on homepage
          </label>
          <div>
            <label className="label" htmlFor="category_id">Category</label>
            <select className="input" id="category_id" name="category_id" defaultValue={product?.category_id ?? ""}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card p-5">
          <ImageInput name="image_url" label="Main photo" defaultValue={product?.image_url} />
        </div>
        <GalleryEditor storeId={storeId} initial={images} />
        <FormMessage state={state} />
        <SubmitButton className="btn-primary w-full">{product ? "Save changes" : "Add product"}</SubmitButton>
      </div>
    </form>
  );
}
