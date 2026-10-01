"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

import type { StaffRole } from "@/lib/types";

const RANK: Record<StaffRole, number> = { staff: 1, manager: 2, owner: 3 };

const ITEMS: { href: string; label: string; icon: string; min?: StaffRole }[] = [
  { href: "", label: "Overview", icon: "📊" },
  { href: "/reports", label: "Reports", icon: "📈", min: "manager" },
  { href: "/orders", label: "Orders", icon: "📦" },
  { href: "/pos", label: "POS / New order", icon: "🧾" },
  { href: "/inbox", label: "Inbox", icon: "💬" },
  { href: "/products", label: "Products", icon: "🏷️" },
  { href: "/categories", label: "Categories", icon: "🗂️" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/reviews", label: "Reviews", icon: "⭐" },
  { href: "/coupons", label: "Coupons", icon: "🎟️" },
  { href: "/payments", label: "Payments", icon: "💳", min: "owner" },
  { href: "/delivery", label: "Delivery", icon: "🚚", min: "manager" },
  { href: "/design", label: "Website design", icon: "🎨", min: "manager" },
  { href: "/team", label: "Team", icon: "🧑‍🤝‍🧑", min: "owner" },
  { href: "/settings", label: "Settings", icon: "⚙️", min: "owner" },
];

export function AdminNav({ storeId, pending, unread = 0, role = "owner" }: { storeId: string; pending: number; unread?: number; role?: StaffRole }) {
  const pathname = usePathname();
  const base = `/dashboard/${storeId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.filter((item) => RANK[role] >= RANK[item.min ?? "staff"]).map((item) => {
        const href = base + item.href;
        const active = item.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={item.href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-indigo-50 text-indigo-700" : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
            {item.href === "/inbox" && unread > 0 && (
              <span className="ml-auto rounded-full bg-indigo-600 px-2 py-0.5 text-xs text-white">{unread}</span>
            )}
            {item.href === "/orders" && pending > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
