import "server-only";
import { createRow, deleteRow, firstRow, getRow, listAllRows, listRows, Query, updateRow } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { setStoreSecret } from "@/lib/data";
import type { AutoReply, Channel, ChannelKind, Conversation, Message } from "@/lib/types";

/* Channels */

export const listChannels = (storeId: string) =>
  listAllRows<Channel>(TABLES.channels, [Query.equal("store_id", storeId), Query.orderAsc("$createdAt")]);

export const getChannel = (id: string) => getRow<Channel>(TABLES.channels, id);

export const findChannel = (kind: ChannelKind, externalId: string) =>
  firstRow<Channel>(TABLES.channels, [Query.equal("kind", kind), Query.equal("external_id", externalId), Query.equal("active", true)]);

export const createChannel = (data: Pick<Channel, "store_id" | "kind" | "name" | "external_id">) =>
  createRow<Channel>(TABLES.channels, data);

export async function deleteChannel(channel: Channel) {
  await setStoreSecret(channel.store_id, `channel:${channel.id}`, null);
  await deleteRow(TABLES.channels, channel.id);
}

/** Every store has one built-in "web" channel for the chat bubble on its website. */
export async function webChannel(storeId: string): Promise<Channel> {
  const existing = await firstRow<Channel>(TABLES.channels, [Query.equal("store_id", storeId), Query.equal("kind", "web")]);
  return existing ?? createChannel({ store_id: storeId, kind: "web", name: "Website chat", external_id: storeId });
}

/* Conversations */

export async function upsertConversation(channel: Channel, externalUserId: string, name: string): Promise<Conversation> {
  const q = [Query.equal("channel_id", channel.id), Query.equal("external_user_id", externalUserId)];
  const existing = await firstRow<Conversation>(TABLES.conversations, q);
  if (existing) {
    if (name && !existing.customer_name) return updateRow<Conversation>(TABLES.conversations, existing.id, { customer_name: name });
    return existing;
  }
  try {
    return await createRow<Conversation>(TABLES.conversations, {
      store_id: channel.store_id,
      channel_id: channel.id,
      kind: channel.kind,
      external_user_id: externalUserId,
      customer_name: name,
      last_at: new Date().toISOString(),
    });
  } catch {
    // Two messages raced to create the same conversation.
    const again = await firstRow<Conversation>(TABLES.conversations, q);
    if (again) return again;
    throw new Error("Could not create conversation");
  }
}

export const getConversation = async (storeId: string, id: string) => {
  const c = await getRow<Conversation>(TABLES.conversations, id);
  return c && c.store_id === storeId ? c : null;
};

export const listConversations = (storeId: string) =>
  listRows<Conversation>(TABLES.conversations, [Query.equal("store_id", storeId), Query.orderDesc("last_at"), Query.limit(100)]).then((r) => r.rows);

export const updateConversation = (id: string, data: Partial<Conversation>) => updateRow<Conversation>(TABLES.conversations, id, data);

/* Messages */

export const listMessages = (conversationId: string, limit = 200) =>
  listRows<Message>(TABLES.messages, [Query.equal("conversation_id", conversationId), Query.orderDesc("created_at"), Query.limit(limit)]).then((r) =>
    r.rows.reverse(),
  );

export const messageExists = async (conversationId: string, externalId: string) =>
  !!externalId && !!(await firstRow<Message>(TABLES.messages, [Query.equal("conversation_id", conversationId), Query.equal("external_id", externalId)]));

export async function addMessage(conv: Conversation, m: Pick<Message, "direction" | "sender" | "text"> & { external_id?: string }) {
  const now = new Date().toISOString();
  const msg = await createRow<Message>(TABLES.messages, {
    store_id: conv.store_id,
    conversation_id: conv.id,
    direction: m.direction,
    sender: m.sender,
    text: m.text.slice(0, 4000),
    external_id: m.external_id ?? "",
    created_at: now,
  });
  await updateRow(TABLES.conversations, conv.id, {
    last_message: m.text.slice(0, 300),
    last_at: now,
    ...(m.direction === "in" ? { unread: (conv.unread ?? 0) + 1 } : {}),
  });
  if (m.direction === "in") conv.unread = (conv.unread ?? 0) + 1;
  return msg;
}

/* Auto replies */

export const listAutoReplies = (storeId: string) =>
  listAllRows<AutoReply>(TABLES.autoReplies, [Query.equal("store_id", storeId), Query.orderAsc("$createdAt")]);

export const createAutoReply = (storeId: string, keywords: string, reply: string) =>
  createRow<AutoReply>(TABLES.autoReplies, { store_id: storeId, keywords, reply });

export const deleteAutoReply = (id: string) => deleteRow(TABLES.autoReplies, id);
export const updateAutoReply = (id: string, data: Partial<AutoReply>) => updateRow<AutoReply>(TABLES.autoReplies, id, data);
