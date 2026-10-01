import { STATUS_STYLES } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-700"}`}>{status}</span>;
}
