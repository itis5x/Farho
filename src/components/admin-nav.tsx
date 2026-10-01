"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "", label: "Overview", icon: "📊" },
  { href: "/orders", label: "Orders", icon: "📦" },
  { href: "/products", label: "Products", icon: "🏷️" },
  { href: "/categories", label: "Categories", icon: "🗂️" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/coupons", label: "Coupons", icon: "🎟️" },
  { href: "/design", label: "Website design", icon: "🎨" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function AdminNav({ storeId, pending }: { storeId: number; pending: number }) {
  const pathname = usePathname();
  const base = `/dashboard/${storeId}`;
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {ITEMS.map((item) => {
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
            {item.href === "/orders" && pending > 0 && (
              <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
