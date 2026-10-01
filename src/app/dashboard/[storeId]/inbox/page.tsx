import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh";
import { CHANNEL_LABEL, ChannelIcon } from "@/components/channel-icon";
import { SubmitButton } from "@/components/form";
import { markRead, sellerSend, toggleBot } from "@/lib/actions/inbox";
import { requireStore } from "@/lib/auth";
import { aiAvailable } from "@/lib/inbox/ai";
import { getConversation, listChannels, listConversations, listMessages } from "@/lib/inbox/data";
import { getInboxSettings } from "@/lib/inbox/settings";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Inbox" };

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/[^\s]+)/g).map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" className="break-all underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { storeId } = await params;
  const { c } = await searchParams;
  const { store } = await requireStore(storeId);
  const [conversations, channels] = await Promise.all([listConversations(store.id), listChannels(store.id)]);
  const active = c ? await getConversation(store.id, c) : null;
  const messages = active ? await listMessages(active.id) : [];
  if (active?.unread) await markRead(store.id, active.id);
  const settings = getInboxSettings(store);
  const assistant = settings.ai_enabled && aiAvailable() ? "AI assistant" : "Auto-reply bot";
  const connected = channels.filter((ch) => ch.kind !== "web");
  const base = `/dashboard/${store.id}/inbox`;

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={5} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-zinc-600">
            All your customer chats in one place. {assistant} answers instantly; you can jump in any time.
          </p>
        </div>
        <Link href={`${base}/settings`} className="btn-secondary">
          ⚙️ Channels & assistant
        </Link>
      </div>
      {connected.length === 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
          Your website chat is live. <Link href={`${base}/settings`} className="font-semibold underline">Connect Messenger, Instagram, WhatsApp or Telegram</Link> to answer all your DMs here too.
        </div>
      )}

      <div className="card grid h-[calc(100vh-14rem)] min-h-[480px] overflow-hidden md:grid-cols-[320px_1fr]">
        <ul className={cn("divide-y divide-zinc-100 overflow-y-auto border-r border-zinc-100", active && "hidden md:block")}>
          {conversations.length === 0 && <li className="p-6 text-center text-sm text-zinc-500">No conversations yet.</li>}
          {conversations.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`${base}?c=${conv.id}`}
                className={cn("flex gap-3 px-4 py-3 hover:bg-zinc-50", active?.id === conv.id && "bg-indigo-50")}
              >
                <ChannelIcon kind={conv.kind} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", conv.unread ? "font-bold" : "font-medium")}>
                      {conv.customer_name || `${CHANNEL_LABEL(conv.kind)} visitor`}
                    </span>
                    {conv.unread > 0 && <span className="rounded-full bg-indigo-600 px-1.5 text-xs text-white">{conv.unread}</span>}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{conv.last_message}</p>
                  <p className="text-[11px] text-zinc-400">{formatDate(conv.last_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {active ? (
          <div className="flex min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <Link href={base} className="text-zinc-500 md:hidden">←</Link>
                <ChannelIcon kind={active.kind} />
                <div>
                  <div className="font-semibold">{active.customer_name || `${CHANNEL_LABEL(active.kind)} visitor`}</div>
                  <div className="text-xs text-zinc-500">{CHANNEL_LABEL(active.kind)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {active.customer_id && (
                  <Link href={`/dashboard/${store.id}/customers/${active.customer_id}`} className="btn-secondary px-3 py-1.5 text-xs">
                    Customer profile
                  </Link>
                )}
                <form action={toggleBot.bind(null, store.id, active.id)}>
                  <button
                    className={cn(
                      "btn px-3 py-1.5 text-xs",
                      active.bot_paused ? "bg-zinc-100 text-zinc-700" : "bg-emerald-100 text-emerald-800",
                    )}
                    title="When paused, only you reply in this chat"
                  >
                    {active.bot_paused ? "🤖 Assistant paused — resume" : "🤖 Assistant on — pause"}
                  </button>
                </form>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 p-4 text-sm">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "in" ? "justify-start" : "justify-end")}>
                  <div className="max-w-[75%]">
                    <div
                      className={cn(
                        "whitespace-pre-line rounded-2xl px-3 py-2",
                        m.direction === "in"
                          ? "rounded-bl-sm bg-white shadow-xs"
                          : m.sender === "seller"
                            ? "rounded-br-sm bg-indigo-600 text-white"
                            : "rounded-br-sm bg-emerald-600 text-white",
                      )}
                    >
                      <Linkified text={m.text} />
                    </div>
                    <div className={cn("mt-0.5 text-[11px] text-zinc-400", m.direction === "out" && "text-right")}>
                      {m.direction === "out" && (m.sender === "seller" ? "You · " : m.sender === "ai" ? "AI assistant · " : "Auto-reply · ")}
                      {formatDate(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <form action={sellerSend.bind(null, store.id, active.id)} className="flex gap-2 border-t border-zinc-100 p-3">
              <input name="text" className="input" placeholder="Type your reply…" autoComplete="off" required />
              <SubmitButton pendingText="Sending…">Send</SubmitButton>
            </form>
          </div>
        ) : (
          <div className="hidden place-items-center text-sm text-zinc-500 md:grid">Select a conversation</div>
        )}
      </div>
    </div>
  );
}
