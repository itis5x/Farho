import { ConfirmButton } from "@/components/form";
import { disconnectCourier } from "@/lib/actions/delivery";
import { requireStore } from "@/lib/auth";
import { ncmBranches } from "@/lib/couriers/ncm";
import { courierWebhookSecret, getNcm, getPathao } from "@/lib/couriers/service";
import { siteOrigin } from "@/lib/payments/service";
import { NcmForm, PathaoForm } from "./forms";

export const metadata = { title: "Delivery" };

export default async function DeliveryPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const [pathao, ncm, branches, secret, origin] = await Promise.all([
    getPathao(store.id),
    getNcm(store.id),
    ncmBranches().catch(() => []),
    courierWebhookSecret(store.id),
    siteOrigin(),
  ]);
  const hook = `${origin}/api/webhooks/courier/${store.id}/${secret}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delivery</h1>
        <p className="text-sm text-zinc-600">
          Connect your courier accounts once. Then book a delivery from any order in one click — no retyping addresses, cash-on-delivery amount filled in for you.
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8202a] text-xs font-bold text-white">P</span> Pathao Parcel
          </h2>
          {pathao && (
            <form action={disconnectCourier.bind(null, store.id, "pathao")}>
              <ConfirmButton className="btn px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50" message="Disconnect Pathao?">Disconnect</ConfirmButton>
            </form>
          )}
        </div>
        {pathao && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ Connected as {pathao.username}{pathao.sandbox ? " (sandbox)" : ""} · pickup store #{pathao.store_id}
          </p>
        )}
        <PathaoForm storeId={store.id} connected={!!pathao} sandbox={pathao?.sandbox ?? false} />
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0b4ea2] text-xs font-bold text-white">NCM</span> Nepal Can Move
          </h2>
          {ncm && (
            <form action={disconnectCourier.bind(null, store.id, "ncm")}>
              <ConfirmButton className="btn px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50" message="Disconnect Nepal Can Move?">Disconnect</ConfirmButton>
            </form>
          )}
        </div>
        {ncm && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            ✓ Connected{ncm.sandbox ? " (demo)" : ""} · pickup from {ncm.pickup_branch}
          </p>
        )}
        <NcmForm storeId={store.id} branches={branches.map((b) => b.name)} current={ncm?.pickup_branch ?? ""} />
      </section>

      <section className="card space-y-2 p-5 text-sm">
        <h2 className="font-semibold">Automatic status updates</h2>
        <p className="text-zinc-600">
          Paste this webhook URL into your Pathao (Developer API → Webhook) and NCM (API Integration → Webhook) settings. Orders then update by themselves as the courier picks up and delivers — and cash-on-delivery orders are marked paid on delivery.
        </p>
        <code className="block break-all rounded-lg bg-zinc-100 p-3 text-xs select-all">{hook}</code>
      </section>
    </div>
  );
}
