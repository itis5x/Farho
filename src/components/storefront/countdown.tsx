"use client";

import { useEffect, useState } from "react";

export function Countdown({ endsAt }: { endsAt: string }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (Number.isNaN(end)) return null;
  const left = Math.max(0, end - (now ?? end));
  const parts = [
    ["Days", Math.floor(left / 86_400_000)],
    ["Hours", Math.floor(left / 3_600_000) % 24],
    ["Mins", Math.floor(left / 60_000) % 60],
    ["Secs", Math.floor(left / 1000) % 60],
  ] as const;
  if (now !== null && left === 0) return <p className="mt-4 text-lg font-semibold text-white/80">This offer has ended.</p>;
  return (
    <div className="mt-6 flex justify-center gap-3">
      {parts.map(([label, value]) => (
        <div key={label} className="w-20 rounded-xl bg-white/10 py-3">
          <div className="text-3xl font-bold tabular-nums">{now === null ? "--" : String(value).padStart(2, "0")}</div>
          <div className="text-xs uppercase tracking-wider text-white/70">{label}</div>
        </div>
      ))}
    </div>
  );
}
