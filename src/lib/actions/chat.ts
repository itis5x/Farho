"use server";

import { getStoreBySlug } from "@/lib/data";
import { firstRow, Query } from "@/lib/appwrite";
import { TABLES } from "@/lib/appwrite-schema";
import { listMessages, webChannel } from "@/lib/inbox/data";
import { handleIncoming } from "@/lib/inbox/engine";
import type { Conversation } from "@/lib/types";

export type ChatBubble = { id: string; mine: boolean; text: string; at: string };

const validSession = (s: string) => /^[a-zA-Z0-9-]{16,40}$/.test(s);

async function load(storeSlug: string, sessionId: string) {
  const store = await getStoreBySlug(storeSlug);
  if (!store?.published || !validSession(sessionId)) return null;
  const channel = await webChannel(store.id);
  const conv = await firstRow<Conversation>(TABLES.conversations, [Query.equal("channel_id", channel.id), Query.equal("external_user_id", sessionId)]);
  return { store, channel, conv };
}

async function bubbles(conv: Conversation | null): Promise<ChatBubble[]> {
  if (!conv) return [];
  return (await listMessages(conv.id, 100)).map((m) => ({ id: m.id, mine: m.direction === "in", text: m.text, at: m.created_at }));
}

/** Website chat bubble: send a customer message and get the conversation back (including the reply). */
export async function chatSend(storeSlug: string, sessionId: string, text: string, name: string): Promise<{ error?: string; messages: ChatBubble[] }> {
  const ctx = await load(storeSlug, sessionId);
  const clean = text.trim().slice(0, 1000);
  if (!ctx) return { error: "Chat is unavailable.", messages: [] };
  if (!clean) return { messages: await bubbles(ctx.conv) };
  if (ctx.conv) {
    const recent = (await listMessages(ctx.conv.id, 10)).filter((m) => m.direction === "in" && Date.now() - new Date(m.created_at).getTime() < 60_000);
    if (recent.length >= 8) return { error: "You're sending messages too quickly. Please wait a moment.", messages: await bubbles(ctx.conv) };
  }
  const { conversation } = await handleIncoming({ channel: ctx.channel, externalUserId: sessionId, name: name.trim().slice(0, 80), text: clean });
  return { messages: await bubbles(conversation) };
}

export async function chatPoll(storeSlug: string, sessionId: string): Promise<ChatBubble[]> {
  const ctx = await load(storeSlug, sessionId);
  return ctx ? bubbles(ctx.conv) : [];
}
