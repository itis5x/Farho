import type { ChannelKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<ChannelKind, [string, string, string]> = {
  web: ["bg-zinc-700", "💬", "Website chat"],
  messenger: ["bg-[#0866ff]", "m", "Messenger"],
  instagram: ["bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af]", "ig", "Instagram"],
  whatsapp: ["bg-[#25d366]", "wa", "WhatsApp"],
  telegram: ["bg-[#229ed9]", "tg", "Telegram"],
};

export const CHANNEL_LABEL = (k: ChannelKind) => STYLES[k][2];

export function ChannelIcon({ kind, className }: { kind: ChannelKind; className?: string }) {
  const [bg, text, label] = STYLES[kind];
  return (
    <span title={label} className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white", bg, className)}>
      {text}
    </span>
  );
}
