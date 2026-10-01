"use client";

import { useState } from "react";

/** Image field that accepts either an uploaded file or a pasted URL. */
export function ImageInput({
  name,
  label,
  defaultValue = "",
  aspect = "aspect-square",
}: {
  name: string;
  label: string;
  defaultValue?: string;
  aspect?: string;
}) {
  const [preview, setPreview] = useState(defaultValue);
  const [cleared, setCleared] = useState(false);
  const [url, setUrl] = useState(defaultValue.startsWith("/uploads/") ? "" : defaultValue);

  return (
    <div>
      <span className="label">{label}</span>
      <div className={`relative overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50 ${aspect}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-zinc-400">No image</div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
          Upload
          <input
            type="file"
            name={`${name}_file`}
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setPreview(URL.createObjectURL(f));
                setCleared(false);
              }
            }}
          />
        </label>
        {preview && (
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => {
              setPreview("");
              setUrl("");
              setCleared(true);
            }}
          >
            Remove
          </button>
        )}
      </div>
      <input
        type="url"
        name={name}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setPreview(e.target.value);
          setCleared(false);
        }}
        placeholder="…or paste an image URL"
        className="input mt-2 text-xs"
      />
      {cleared && <input type="hidden" name={`${name}_clear`} value="1" />}
    </div>
  );
}
