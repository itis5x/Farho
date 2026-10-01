export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatMoney(amount: number, currency = "NPR"): string {
  const symbol = currency === "NPR" ? "Rs." : currency === "INR" ? "₹" : currency === "USD" ? "$" : currency + " ";
  const value = Number.isInteger(amount)
    ? amount.toLocaleString("en-IN")
    : amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${symbol} ${value}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const RESERVED_SLUGS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "dashboard",
  "store",
  "login",
  "signup",
  "logout",
  "uploads",
  "static",
  "mail",
]);

export const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-violet-100 text-violet-800",
  delivered: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  unpaid: "bg-zinc-100 text-zinc-700",
  paid: "bg-emerald-100 text-emerald-800",
  refunded: "bg-rose-100 text-rose-800",
};

export function storeUrl(slug: string): string {
  return `/store/${slug}`;
}
