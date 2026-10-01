import "server-only";
import { getStore } from "@/lib/data";
import { siteOrigin } from "@/lib/payments/service";
import type { Channel, Conversation, Message } from "@/lib/types";
import { aiReply } from "./ai";
import { matchAutoReply, ruleReply, fill } from "./bot";
import { addMessage, listAutoReplies, listMessages, messageExists, updateConversation, upsertConversation } from "./data";
import { getInboxSettings } from "./settings";
import { deliver } from "./transport";

// Meta and Telegram may deliver the same message more than once, sometimes at the same moment.
const recent = new Map<string, number>();
function seenRecently(key: string) {
  const now = Date.now();
  for (const [k, t] of recent) if (now - t > 10 * 60_000) recent.delete(k);
  if (recent.has(key)) return true;
  recent.set(key, now);
  return false;
}

export type Incoming = { channel: Channel; externalUserId: string; name: string; text: string; externalId?: string };

/** Stores an incoming customer message and answers it (keyword rules → AI assistant → built-in replies). */
export async function handleIncoming(m: Incoming): Promise<{ conversation: Conversation; replies: Message[] }> {
  const conv = await upsertConversation(m.channel, m.externalUserId, m.name);
  if (m.externalId && seenRecently(`${m.channel.id}:${m.externalId}`)) return { conversation: conv, replies: [] };
  if (m.externalId && (await messageExists(conv.id, m.externalId))) return { conversation: conv, replies: [] }; // webhook retry
  const history = await listMessages(conv.id, 40);
  const isFirst = history.length === 0;
  const incoming = await addMessage(conv, { direction: "in", sender: "customer", text: m.text, external_id: m.externalId });
  if (conv.bot_paused) return { conversation: conv, replies: [] };

  const store = await getStore(conv.store_id);
  if (!store) return { conversation: conv, replies: [] };
  const settings = getInboxSettings(store);
  const origin = await siteOrigin();

  let reply: string | null = null;
  let sender: Message["sender"] = "bot";
  const rule = matchAutoReply(await listAutoReplies(store.id), m.text);
  if (rule) reply = fill(rule.reply, store, origin);
  if (!reply) {
    reply = await aiReply(store, conv, [...history, incoming], settings, origin);
    if (reply) sender = "ai";
  }
  if (!reply) reply = await ruleReply(store, conv, m.text, isFirst, settings, origin);

  const sent = await sendReply(m.channel, conv, reply, sender);
  return { conversation: conv, replies: sent ? [sent] : [] };
}

/** Stores and delivers a reply from the store (seller, rule bot or AI). */
export async function sendReply(channel: Channel, conv: Conversation, text: string, sender: Message["sender"]) {
  let externalId = "";
  try {
    externalId = await deliver(channel, conv, text);
  } catch (e) {
    console.error("Delivery failed", e);
    const failed = await addMessage(conv, { direction: "out", sender, text: `${text}\n\n⚠️ Not delivered: ${(e as Error).message}` });
    return failed;
  }
  const msg = await addMessage(conv, { direction: "out", sender, text, external_id: externalId });
  if (sender === "seller") await updateConversation(conv.id, { unread: 0 });
  return msg;
}
