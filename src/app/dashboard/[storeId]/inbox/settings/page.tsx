import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CHANNEL_LABEL, ChannelIcon } from "@/components/channel-icon";
import { ConfirmButton, SubmitButton } from "@/components/form";
import { addAutoReply, disconnectChannel, removeAutoReply } from "@/lib/actions/inbox";
import { requireStore } from "@/lib/auth";
import { aiAvailable } from "@/lib/inbox/ai";
import { listAutoReplies, listChannels } from "@/lib/inbox/data";
import { getInboxSettings } from "@/lib/inbox/settings";
import { AssistantForm, ConnectMeta, ConnectTelegram } from "./forms";

export const metadata = { title: "Channels & assistant" };

export default async function InboxSettingsPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId, "manager");
  const [channels, rules] = await Promise.all([listChannels(store.id), listAutoReplies(store.id)]);
  const connected = channels.filter((c) => c.kind !== "web");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/dashboard/${store.id}/inbox`} className="text-sm text-zinc-500 hover:underline">← Inbox</Link>
        <h1 className="mt-1 text-2xl font-bold">Channels & assistant</h1>
        <p className="text-sm text-zinc-600">Connect your social accounts and teach your assistant how to answer customers.</p>
      </div>

      <section className="card">
        <h2 className="border-b border-zinc-100 px-5 py-4 font-semibold">Connected channels</h2>
        <ul className="divide-y divide-zinc-100">
          <li className="flex items-center gap-3 px-5 py-3 text-sm">
            <ChannelIcon kind="web" />
            <span className="flex-1">
              <span className="font-medium">Website chat</span>
              <span className="block text-xs text-zinc-500">Chat bubble on every page of your store — always on.</span>
            </span>
            <span className="badge bg-emerald-100 text-emerald-800">Live</span>
          </li>
          {connected.map((ch) => (
            <li key={ch.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <ChannelIcon kind={ch.kind} />
              <span className="flex-1">
                <span className="font-medium">{ch.name}</span>
                <span className="block text-xs text-zinc-500">{CHANNEL_LABEL(ch.kind)}</span>
              </span>
              <form action={disconnectChannel.bind(null, store.id, ch.id)}>
                <ConfirmButton className="btn px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50" message={`Disconnect ${ch.name}?`}>
                  Disconnect
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ConnectTelegram storeId={store.id} />
        <ConnectMeta storeId={store.id} kind="whatsapp" />
        <ConnectMeta storeId={store.id} kind="messenger" />
        <ConnectMeta storeId={store.id} kind="instagram" />
      </section>

      <AssistantForm storeId={store.id} settings={getInboxSettings(store)} aiAvailable={aiAvailable()} />

      <section className="card">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h2 className="font-semibold">Keyword auto-replies</h2>
          <p className="text-sm text-zinc-600">
            When a message contains one of the keywords, this reply is sent first. Use <code>{"{link}"}</code> for your store link.
          </p>
        </div>
        <ul className="divide-y divide-zinc-100">
          {rules.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-3 text-sm">
              <div className="flex-1">
                <div className="flex flex-wrap gap-1">
                  {r.keywords.split(",").map((k) => (
                    <span key={k} className="badge bg-indigo-50 normal-case text-indigo-700">{k.trim()}</span>
                  ))}
                </div>
                <p className="mt-1 whitespace-pre-line text-zinc-700">{r.reply}</p>
              </div>
              <form action={removeAutoReply.bind(null, store.id, r.id)}>
                <ConfirmButton className="btn px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" message="Delete this auto-reply?">
                  Delete
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={addAutoReply.bind(null, store.id)} className="space-y-3 border-t border-zinc-100 p-5">
          <div>
            <label className="label" htmlFor="keywords">Keywords (comma separated)</label>
            <input id="keywords" name="keywords" className="input" placeholder="return, exchange, refund" required />
          </div>
          <div>
            <label className="label" htmlFor="reply">Reply</label>
            <textarea id="reply" name="reply" className="input min-h-20" placeholder="You can exchange items within 7 days. Just reply with your order number!" required />
          </div>
          <SubmitButton>Add auto-reply</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
