import crypto from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { findChannel, getChannel } from "@/lib/inbox/data";
import { handleIncoming } from "@/lib/inbox/engine";
import { channelSecret } from "@/lib/inbox/transport";
import type { Channel, ChannelKind } from "@/lib/types";

/**
 * Meta webhooks for Messenger, Instagram and WhatsApp.
 *  - /api/webhooks/meta/<channelId>: a store's own Meta app (verify token + app secret saved on the channel).
 *  - /api/webhooks/meta: Farho's platform Meta app (META_VERIFY_TOKEN + META_APP_SECRET), routed by page/number id.
 */

async function credentials(channelId?: string) {
  if (!channelId) return { channel: null, verifyToken: process.env.META_VERIFY_TOKEN ?? "", appSecret: process.env.META_APP_SECRET ?? "" };
  const channel = /^[a-zA-Z0-9]{1,36}$/.test(channelId) ? await getChannel(channelId) : null;
  const secret = channel ? await channelSecret(channel) : null;
  return { channel, verifyToken: secret?.verify_token ?? "", appSecret: secret?.app_secret ?? "" };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId?: string[] }> }) {
  const { channelId } = await params;
  const { verifyToken } = await credentials(channelId?.[0]);
  const q = req.nextUrl.searchParams;
  if (verifyToken && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === verifyToken) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type MetaBody = {
  object: "page" | "instagram" | "whatsapp_business_account";
  entry: {
    id: string;
    messaging?: { sender: { id: string }; recipient: { id: string }; message?: { mid: string; text?: string; is_echo?: boolean } }[];
    changes?: {
      value: {
        metadata?: { phone_number_id: string };
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: { id: string; from: string; type: string; text?: { body: string } }[];
      };
    }[];
  }[];
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId?: string[] }> }) {
  const { channelId } = await params;
  const { channel: fixed, appSecret } = await credentials(channelId?.[0]);
  const raw = await req.text();

  // Verify Meta's signature over the raw body.
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(raw).digest("hex")}`;
  if (!appSecret || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("Bad signature", { status: 401 });
  }

  const body = JSON.parse(raw) as MetaBody;
  const jobs: { kind: ChannelKind; accountId: string; userId: string; name: string; text: string; id: string }[] = [];
  for (const entry of body.entry ?? []) {
    if (body.object === "whatsapp_business_account") {
      for (const change of entry.changes ?? []) {
        const v = change.value;
        for (const m of v.messages ?? []) {
          if (m.type !== "text" || !m.text) continue;
          const name = v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? "";
          jobs.push({ kind: "whatsapp", accountId: v.metadata?.phone_number_id ?? "", userId: m.from, name, text: m.text.body, id: m.id });
        }
      }
    } else {
      for (const ev of entry.messaging ?? []) {
        if (!ev.message?.text || ev.message.is_echo) continue;
        jobs.push({
          kind: body.object === "instagram" ? "instagram" : "messenger",
          accountId: entry.id,
          userId: ev.sender.id,
          name: "",
          text: ev.message.text,
          id: ev.message.mid,
        });
      }
    }
  }

  after(async () => {
    for (const j of jobs) {
      const channel: Channel | null = fixed ?? (await findChannel(j.kind, j.accountId));
      if (!channel || channel.kind !== j.kind || !channel.active) continue;
      await handleIncoming({ channel, externalUserId: j.userId, name: j.name, text: j.text, externalId: j.id }).catch((e) =>
        console.error("Meta message failed", e),
      );
    }
  });
  return NextResponse.json({ ok: true });
}
