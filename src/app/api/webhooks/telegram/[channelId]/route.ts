import crypto from "node:crypto";
import { after, NextResponse } from "next/server";
import { getChannel } from "@/lib/inbox/data";
import { handleIncoming } from "@/lib/inbox/engine";
import { channelSecret } from "@/lib/inbox/transport";

type Update = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: { first_name?: string; last_name?: string; username?: string }; text?: string };
};

export async function POST(req: Request, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const channel = /^[a-zA-Z0-9]{1,36}$/.test(channelId) ? await getChannel(channelId) : null;
  if (!channel || channel.kind !== "telegram" || !channel.active) return new NextResponse(null, { status: 404 });
  const secret = await channelSecret(channel);
  const given = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expected = secret?.webhook_secret ?? "";
  if (!expected || given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new NextResponse(null, { status: 401 });
  }

  const update = (await req.json()) as Update;
  const msg = update.message;
  if (msg?.text && msg.chat.type === "private") {
    const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || msg.from?.username || "";
    after(() =>
      handleIncoming({ channel, externalUserId: String(msg.chat.id), name, text: msg.text!, externalId: `tg-${msg.message_id}` }).catch((e) =>
        console.error("Telegram message failed", e),
      ),
    );
  }
  return NextResponse.json({ ok: true });
}
