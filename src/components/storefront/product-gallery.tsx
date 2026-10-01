"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) return <div className="grid aspect-square place-items-center rounded-2xl bg-zinc-100 text-7xl text-zinc-300">🛍️</div>;
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl bg-zinc-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[active]} alt={name} className="aspect-square w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn("aspect-square overflow-hidden rounded-lg ring-2 ring-offset-1", i === active ? "ring-brand" : "ring-transparent")}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
