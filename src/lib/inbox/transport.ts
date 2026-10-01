import "server-only";
import { getStoreSecret } from "@/lib/data";
import type { Channel, Conversation } from "@/lib/types";

export const GRAPH = "https://graph.facebook.com/v21.0";

export type ChannelSecret = {
  /** Telegram bot token. */
  bot_token?: string;
  /** Telegram webhook secret we generated. */
  webhook_secret?: string;
  /** Messenger / Instagram page access token, or WhatsApp permanent token. */
  access_token?: string;
  /** Meta app secret used to verify webhook signatures (own-app setups). */
  app_secret?: string;
  /** Verify token the store pastes into their Meta app's webhook settings. */
  verify_token?: string;
};

export const channelSecret = (channel: Channel) => getStoreSecret<ChannelSecret>(channel.store_id, `channel:${channel.id}`);

/** Sends a text message to the customer on the conversation's channel. Website chat needs no delivery. */
export async function deliver(channel: Channel, conv: Conversation, text: string): Promise<string> {
  if (channel.kind === "web") return "";
  const secret = await channelSecret(channel);
  if (!secret) throw new Error("This channel is missing its credentials.");

  if (channel.kind === "telegram") {
    const res = await fetch(`https://api.telegram.org/bot${secret.bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: conv.external_user_id, text }),
    });
    const body = (await res.json()) as { ok: boolean; result?: { message_id: number }; description?: string };
    if (!body.ok) throw new Error(`Telegram: ${body.description}`);
    return String(body.result?.message_id ?? "");
  }

  if (channel.kind === "messenger" || channel.kind === "instagram") {
    const res = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(secret.access_token ?? "")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: conv.external_user_id }, messaging_type: "RESPONSE", message: { text } }),
    });
    const body = (await res.json()) as { message_id?: string; error?: { message: string } };
    if (!res.ok) throw new Error(`Meta: ${body.error?.message ?? res.status}`);
    return body.message_id ?? "";
  }

  // WhatsApp Cloud API: replies inside the 24h customer-service window are free.
  const res = await fetch(`${GRAPH}/${channel.external_id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret.access_token}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to: conv.external_user_id, type: "text", text: { body: text } }),
  });
  const body = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
  if (!res.ok) throw new Error(`WhatsApp: ${body.error?.message ?? res.status}`);
  return body.messages?.[0]?.id ?? "";
}
