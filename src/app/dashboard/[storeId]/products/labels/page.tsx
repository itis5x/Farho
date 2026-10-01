import Link from "next/link";
import { PrintButton } from "@/components/print-button";
import { requireStore } from "@/lib/auth";
import { barcodeSvg } from "@/lib/barcode";
import { listProducts, listStoreVariants, productOptions } from "@/lib/data";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Barcode labels" };

export default async function LabelsPage({ params, searchParams }: { params: Promise<{ storeId: string }>; searchParams: Promise<{ copies?: string }> }) {
  const { storeId } = await params;
  const copies = Math.min(20, Math.max(1, Number((await searchParams).copies) || 1));
  const { store } = await requireStore(storeId);
  const [products, variants] = await Promise.all([listProducts(store.id, { activeOnly: true }), listStoreVariants(store.id)]);

  const labels = products.flatMap((p) => {
    const vs = productOptions(p).length ? variants.filter((v) => v.product_id === p.id) : [];
    if (vs.length) return vs.map((v) => ({ key: v.id, name: p.name, sub: v.title, price: v.price ?? p.price, code: v.sku || p.barcode || p.sku }));
    return [{ key: p.id, name: p.name, sub: "", price: p.price, code: p.barcode || p.sku }];
  });
  const printable = labels.filter((l) => l.code && barcodeSvg(l.code));
  const missing = labels.length - printable.length;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/dashboard/${store.id}/products`} className="text-sm text-zinc-500 hover:underline">← Products</Link>
          <h1 className="mt-1 text-2xl font-bold">Barcode labels</h1>
          <p className="text-sm text-zinc-600">
            Print and stick these on products, then scan them at the POS. Labels use each product&apos;s barcode or SKU.
            {missing > 0 && ` ${missing} item(s) have no barcode or SKU yet.`}
          </p>
        </div>
        <form className="flex items-center gap-2">
          <label htmlFor="copies" className="text-sm">Copies each</label>
          <input id="copies" name="copies" type="number" min={1} max={20} defaultValue={copies} className="input w-20" />
          <button className="btn-secondary">Update</button>
          <PrintButton label="Print labels" />
        </form>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 print:grid-cols-3 print:gap-1">
        {printable.flatMap((l) =>
          Array.from({ length: copies }, (_, i) => (
            <div key={`${l.key}-${i}`} className="break-inside-avoid rounded border border-zinc-300 bg-white p-2 text-center text-[11px] leading-tight">
              <div className="truncate font-semibold">{store.name}</div>
              <div className="truncate">{l.name}{l.sub && ` · ${l.sub}`}</div>
              <div className="mx-auto my-1 h-10 w-full" dangerouslySetInnerHTML={{ __html: barcodeSvg(l.code)! }} />
              <div className="font-mono text-[10px]">{l.code}</div>
              <div className="text-sm font-bold">{formatMoney(l.price, store.currency)}</div>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
