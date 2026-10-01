"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { chatPoll, chatSend, type ChatBubble } from "@/lib/actions/chat";
import { cn } from "@/lib/utils";

function sessionFor(slug: string) {
  const key = `farho_chat_${slug}`;
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

/** Linkify URLs in chat text without using innerHTML. */
function Text({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} className="break-all underline" target="_blank" rel="noopener noreferrer">
            {p.replace(/^https?:\/\/[^/]+/, "")}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ChatWidget({ storeSlug, storeName }: { storeSlug: string; storeName: string }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => setSession(sessionFor(storeSlug)), [storeSlug]);

  const refresh = useCallback(async () => {
    if (session) setMessages(await chatPoll(storeSlug, session));
  }, [session, storeSlug]);

  useEffect(() => {
    if (!open || !session) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [open, session, refresh]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = (value: string) => {
    const msg = value.trim();
    if (!msg || !session) return;
    setText("");
    setError("");
    setMessages((m) => [...m, { id: `tmp-${Date.now()}`, mine: true, text: msg, at: new Date().toISOString() }]);
    start(async () => {
      const res = await chatSend(storeSlug, session, msg, "");
      setMessages(res.messages);
      if (res.error) setError(res.error);
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div>
              <div className="font-semibold">{storeName}</div>
              <div className="text-xs text-white/80">Usually replies instantly</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-2xl leading-none text-white/80 hover:text-white">
              ×
            </button>
          </div>
          <div ref={list} className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 p-3 text-sm">
            {messages.length === 0 && (
              <div className="rounded-xl bg-white p-3 text-zinc-600 shadow-xs">
                👋 Hi! Ask us about products, prices, delivery or your order.
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Show me your products", "Delivery charge?", "Track my order"].map((q) => (
                    <button key={q} onClick={() => send(q)} className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2",
                    m.mine ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-white text-zinc-800 shadow-xs",
                  )}
                >
                  <Text text={m.text} />
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-zinc-400 shadow-xs">typing…</div>
              </div>
            )}
            {error && <p className="text-center text-xs text-rose-600">{error}</p>}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex gap-2 border-t border-zinc-100 p-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-zinc-300 px-4 py-2 text-sm outline-none focus:border-brand"
              maxLength={1000}
              aria-label="Message"
            />
            <button type="submit" disabled={!text.trim()} className="rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">
              Send
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white shadow-lg transition hover:scale-105"
        aria-label={open ? "Close chat" : "Chat with us"}
      >
        {open ? "×" : "💬"}
      </button>
    </div>
  );
}
