import { SettingsForm } from "./form";
import { SmsForm } from "./sms-form";
import { getSms } from "@/lib/sms";
import { deleteStore } from "@/lib/actions/store";
import { requireStore } from "@/lib/auth";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { storeId } = await params;
  const { error } = await searchParams;
  const { store } = await requireStore(storeId, "owner");
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-zinc-600">Store details, delivery and contact information.</p>
      </div>
      <SettingsForm store={store} />
      <SmsForm storeId={store.id} current={await getSms(store.id).then((s) => (s ? { provider: s.provider, sender: s.sender, hasToken: !!s.token, events: s.events } : null))} />
      <div className="card border-rose-200 p-5">
        <h2 className="font-semibold text-rose-700">Delete store</h2>
        <p className="mt-1 text-sm text-zinc-600">
          This permanently deletes {store.name}, including all products, orders and customers. Type{" "}
          <code className="rounded bg-zinc-100 px-1">{store.slug}</code> to confirm.
        </p>
        {error === "confirm" && <p className="mt-2 text-sm text-rose-600">The store address you typed didn&apos;t match.</p>}
        <form action={deleteStore.bind(null, store.id)} className="mt-3 flex gap-2">
          <input name="confirm" className="input max-w-xs" placeholder={store.slug} aria-label="Confirm store address" />
          <button className="btn-danger">Delete store</button>
        </form>
      </div>
    </div>
  );
}
