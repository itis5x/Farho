import type { Store } from "@/lib/types";

export type InboxSettings = {
  /** First reply to a new chat. {store} and {link} are replaced. */
  greeting: string;
  /** Use the AI assistant (needs ANTHROPIC_API_KEY on the server). */
  ai_enabled: boolean;
  /** Let the assistant place orders for customers. */
  take_orders: boolean;
  /** Extra instructions for the assistant: tone, policies, FAQs. */
  ai_instructions: string;
  /** Shown when no rule or assistant can answer. */
  fallback: string;
};

export const DEFAULT_INBOX: InboxSettings = {
  greeting:
    "Namaste! 👋 Welcome to {store}. Ask me about any product, price or your order — or type *menu* to see what we sell.",
  ai_enabled: true,
  take_orders: true,
  ai_instructions: "",
  fallback: "Thanks for your message! Our team will reply shortly. You can also shop here: {link}",
};

export function getInboxSettings(store: Pick<Store, "inbox">): InboxSettings {
  try {
    return { ...DEFAULT_INBOX, ...(store.inbox ? JSON.parse(store.inbox) : {}) };
  } catch {
    return DEFAULT_INBOX;
  }
}
