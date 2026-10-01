"use client";

import { useActionState, useState } from "react";
import { ChannelIcon } from "@/components/channel-icon";
import { FormMessage, SubmitButton, useKeepValuesSubmit } from "@/components/form";
import { connectMeta, connectTelegram, saveInboxSettings } from "@/lib/actions/inbox";
import type { InboxSettings } from "@/lib/inbox/settings";

export function ConnectTelegram({ storeId }: { storeId: string }) {
  const [state, action] = useActionState(connectTelegram.bind(null, storeId), undefined);
  return (
    <form action={action} className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <ChannelIcon kind="telegram" /> Telegram
      </h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-600">
        <li>Open <a href="https://t.me/BotFather" target="_blank" className="text-indigo-600 underline">@BotFather</a> and send <code>/newbot</code>.</li>
        <li>Copy the token it gives you and paste it here.</li>
      </ol>
      <input name="bot_token" className="input font-mono text-xs" placeholder="123456789:AA…" autoComplete="off" required />
      <FormMessage state={state} />
      <SubmitButton pendingText="Connecting…">Connect Telegram</SubmitButton>
    </form>
  );
}

const META: Record<"messenger" | "instagram" | "whatsapp", { title: string; idLabel: string; steps: string[] }> = {
  whatsapp: {
    title: "WhatsApp Business",
    idLabel: "Phone number ID",
    steps: [
      "In developers.facebook.com create an app (type Business) and add the WhatsApp product.",
      "Under WhatsApp → API Setup, copy the Phone number ID and a permanent access token (System User token).",
      "Copy the App secret from App settings → Basic.",
    ],
  },
  messenger: {
    title: "Facebook Messenger",
    idLabel: "Facebook Page ID",
    steps: [
      "In developers.facebook.com create an app and add Messenger.",
      "Generate a Page access token for your Page (needs pages_messaging).",
      "Copy your Page ID (Page → About) and the App secret (App settings → Basic).",
    ],
  },
  instagram: {
    title: "Instagram DMs",
    idLabel: "Instagram account ID",
    steps: [
      "Link your Instagram professional account to a Facebook Page.",
      "In your Meta app add Messenger → Instagram settings and generate a Page access token (needs instagram_manage_messages).",
      "Copy the Instagram account ID and the App secret.",
    ],
  },
};

export function ConnectMeta({ storeId, kind }: { storeId: string; kind: "messenger" | "instagram" | "whatsapp" }) {
  const [state, action] = useActionState(connectMeta.bind(null, storeId), undefined);
  const [open, setOpen] = useState(false);
  const info = META[kind];
  return (
    <div className="card space-y-3 p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <ChannelIcon kind={kind} /> {info.title}
      </h3>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary w-full">
          Connect {info.title}
        </button>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="kind" value={kind} />
          <ol className="list-decimal space-y-1 pl-5 text-xs text-zinc-600">
            {info.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <input name="external_id" className="input" placeholder={info.idLabel} required autoComplete="off" />
          <input name="access_token" className="input font-mono text-xs" placeholder="Access token" required autoComplete="off" />
          <input name="app_secret" className="input font-mono text-xs" placeholder="App secret" required autoComplete="off" />
          <FormMessage state={state} />
          {state && "webhook" in state && state.webhook && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Last step — in your Meta app, open Webhooks and set:</p>
              <p>Callback URL: <code className="break-all select-all">{state.webhook.url}</code></p>
              <p>Verify token: <code className="select-all">{state.webhook.verifyToken}</code></p>
              <p>Then subscribe to <code>messages</code>{kind === "whatsapp" ? "" : " (and messaging_postbacks)"}.</p>
            </div>
          )}
          <SubmitButton pendingText="Checking with Meta…">Connect</SubmitButton>
        </form>
      )}
    </div>
  );
}

export function AssistantForm({ storeId, settings, aiAvailable }: { storeId: string; settings: InboxSettings; aiAvailable: boolean }) {
  const [state, action, pending] = useActionState(saveInboxSettings.bind(null, storeId), undefined);
  const onSubmit = useKeepValuesSubmit(action);
  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <div>
        <h2 className="font-semibold">🤖 Shopping assistant</h2>
        <p className="text-sm text-zinc-600">Answers every chat instantly: products, prices, delivery, order status — and can take orders.</p>
      </div>
      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
        <input type="checkbox" name="ai_enabled" defaultChecked={settings.ai_enabled} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Use AI replies (Claude)</span>
          <span className="block text-zinc-500">
            {aiAvailable
              ? "Understands any question in English or Nepali and holds a real conversation."
              : "AI isn't configured on this server yet — the built-in auto-reply bot answers in the meantime."}
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm">
        <input type="checkbox" name="take_orders" defaultChecked={settings.take_orders} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="font-medium">Let the assistant place orders</span>
          <span className="block text-zinc-500">It confirms items, address and payment with the customer before ordering. Orders show up with the channel they came from.</span>
        </span>
      </label>
      <div>
        <label className="label" htmlFor="greeting">Welcome message</label>
        <textarea id="greeting" name="greeting" defaultValue={settings.greeting} className="input min-h-16" />
      </div>
      <div>
        <label className="label" htmlFor="fallback">When the bot can&apos;t answer</label>
        <textarea id="fallback" name="fallback" defaultValue={settings.fallback} className="input min-h-16" />
      </div>
      <div>
        <label className="label" htmlFor="ai_instructions">Notes for the AI (policies, tone, FAQs)</label>
        <textarea
          id="ai_instructions"
          name="ai_instructions"
          defaultValue={settings.ai_instructions}
          className="input min-h-28"
          placeholder={"Exchanges within 7 days with the tag on.\nWe deliver inside Kathmandu valley in 1–2 days, outside in 3–5 days.\nAlways be warm and use a friendly emoji now and then."}
        />
      </div>
      <FormMessage state={state} />
      <SubmitButton pending={pending}>Save assistant settings</SubmitButton>
    </form>
  );
}
