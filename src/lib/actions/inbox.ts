"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStore } from "@/lib/auth";
import { setStoreSecret, updateStoreRow } from "@/lib/data";
import {
  createAutoReply,
  createChannel,
  deleteAutoReply,
  deleteChannel,
  getChannel,
  getConversation,
  listChannels,
  updateConversation,
} from "@/lib/inbox/data";
import { sendReply } from "@/lib/inbox/engine";
import { getInboxSettings, type InboxSettings } from "@/lib/inbox/settings";
import { GRAPH, type ChannelSecret } from "@/lib/inbox/transport";
import { siteOrigin } from "@/lib/payments/service";
import type { ChannelKind, FormState } from "@/lib/types";

export async function sellerSend(storeId: string, conversationId: string, form: FormData) {
  const { store } = await requireStore(storeId);
  const text = String(form.get("text") ?? "").trim().slice(0, 2000);
  const conv = await getConversation(store.id, conversationId);
  if (!conv || !text) return;
  const channel = await getChannel(conv.channel_id);
  if (!channel) return;
  await sendReply(channel, conv, text, "seller");
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
}

export async function toggleBot(storeId: string, conversationId: string) {
  const { store } = await requireStore(storeId);
  const conv = await getConversation(store.id, conversationId);
  if (conv) await updateConversation(conv.id, { bot_paused: !conv.bot_paused });
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
}

export async function markRead(storeId: string, conversationId: string) {
  const { store } = await requireStore(storeId);
  const conv = await getConversation(store.id, conversationId);
  if (conv?.unread) await updateConversation(conv.id, { unread: 0 });
}

export async function saveInboxSettings(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const next: InboxSettings = {
    ...getInboxSettings(store),
    greeting: String(form.get("greeting") ?? "").trim().slice(0, 500),
    fallback: String(form.get("fallback") ?? "").trim().slice(0, 500),
    ai_instructions: String(form.get("ai_instructions") ?? "").trim().slice(0, 3000),
    ai_enabled: form.get("ai_enabled") === "on",
    take_orders: form.get("take_orders") === "on",
  };
  if (!next.greeting || !next.fallback) return { error: "Greeting and fallback messages can't be empty." };
  await updateStoreRow(store.id, { inbox: JSON.stringify(next) });
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
  return { ok: "Assistant settings saved." };
}

export async function addAutoReply(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const keywords = String(form.get("keywords") ?? "").trim().slice(0, 300);
  const reply = String(form.get("reply") ?? "").trim().slice(0, 1000);
  if (!keywords || !reply) return { error: "Add at least one keyword and a reply." };
  await createAutoReply(store.id, keywords, reply);
  revalidatePath(`/dashboard/${store.id}/inbox/settings`);
  return { ok: "Auto-reply added." };
}

export async function removeAutoReply(storeId: string, id: string) {
  const { store } = await requireStore(storeId);
  await deleteAutoReply(id);
  revalidatePath(`/dashboard/${store.id}/inbox/settings`);
}

export async function disconnectChannel(storeId: string, channelId: string) {
  const { store } = await requireStore(storeId);
  const channel = await getChannel(channelId);
  if (!channel || channel.store_id !== store.id || channel.kind === "web") return;
  if (channel.kind === "telegram") {
    const { channelSecret } = await import("@/lib/inbox/transport");
    const secret = await channelSecret(channel);
    if (secret?.bot_token) await fetch(`https://api.telegram.org/bot${secret.bot_token}/deleteWebhook`).catch(() => null);
  }
  await deleteChannel(channel);
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
}

/* ------------------------------- Connecting ------------------------------ */

export async function connectTelegram(storeId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { store } = await requireStore(storeId);
  const token = String(form.get("bot_token") ?? "").trim();
  if (!/^\d{5,}:[A-Za-z0-9_-]{30,}$/.test(token)) return { error: "That doesn't look like a Telegram bot token (from @BotFather)." };

  const me = (await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json()).catch(() => null)) as {
    ok: boolean;
    result?: { id: number; username: string; first_name: string };
  } | null;
  if (!me?.ok || !me.result) return { error: "Telegram didn't accept that token. Copy it again from @BotFather." };

  const existing = (await listChannels(store.id)).find((c) => c.kind === "telegram" && c.external_id === String(me.result!.id));
  const channel = existing ?? (await createChannel({ store_id: store.id, kind: "telegram", name: `@${me.result.username}`, external_id: String(me.result.id) }));
  const webhookSecret = crypto.randomBytes(24).toString("hex");
  await setStoreSecret(store.id, `channel:${channel.id}`, { bot_token: token, webhook_secret: webhookSecret } satisfies ChannelSecret);

  const origin = await siteOrigin();
  const hook = (await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${origin}/api/webhooks/telegram/${channel.id}`, secret_token: webhookSecret, allowed_updates: ["message"] }),
  })
    .then((r) => r.json())
    .catch(() => null)) as { ok: boolean; description?: string } | null;
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
  if (!hook?.ok) {
    return { error: `Saved, but Telegram couldn't reach ${origin}: ${hook?.description ?? "no response"}. Telegram needs a public https address.` };
  }
  return { ok: `Connected @${me.result.username}. Messages to your bot now arrive in the inbox.` };
}

const metaSchema = z.object({
  kind: z.enum(["messenger", "instagram", "whatsapp"]),
  external_id: z.string().trim().regex(/^\d{5,30}$/, "Enter the numeric ID from Meta."),
  access_token: z.string().trim().min(20, "Paste the access token from Meta."),
  app_secret: z.string().trim().regex(/^[a-f0-9]{32}$/i, "The app secret is the 32-character code under App settings → Basic."),
});

/** Validates the credentials against the Graph API and returns a display name for the account. */
async function checkMeta(kind: ChannelKind, id: string, token: string): Promise<string | null> {
  const fields = kind === "whatsapp" ? "display_phone_number,verified_name" : kind === "instagram" ? "username" : "name";
  const res = await fetch(`${GRAPH}/${id}?fields=${fields}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return null;
  const b = (await res.json()) as { name?: string; username?: string; verified_name?: string; display_phone_number?: string };
  return b.name ?? (b.username ? `@${b.username}` : b.verified_name ? `${b.verified_name} (${b.display_phone_number})` : null);
}

export async function connectMeta(storeId: string, _prev: FormState, form: FormData): Promise<FormState & { webhook?: { url: string; verifyToken: string } }> {
  const { store } = await requireStore(storeId);
  const parsed = metaSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const name = await checkMeta(d.kind, d.external_id, d.access_token);
  if (!name) return { error: "Meta didn't accept that ID and token. Check that the token has messaging permissions for this account." };

  const existing = (await listChannels(store.id)).find((c) => c.kind === d.kind && c.external_id === d.external_id);
  const channel = existing ?? (await createChannel({ store_id: store.id, kind: d.kind, name, external_id: d.external_id }));
  const verifyToken = crypto.randomBytes(16).toString("hex");
  await setStoreSecret(store.id, `channel:${channel.id}`, {
    access_token: d.access_token,
    app_secret: d.app_secret,
    verify_token: verifyToken,
  } satisfies ChannelSecret);
  revalidatePath(`/dashboard/${store.id}/inbox`, "layout");
  const origin = await siteOrigin();
  return {
    ok: `Connected ${name}. Finish by adding this webhook in your Meta app.`,
    webhook: { url: `${origin}/api/webhooks/meta/${channel.id}`, verifyToken },
  };
}
