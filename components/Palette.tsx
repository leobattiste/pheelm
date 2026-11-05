"use client";

import { useEffect, useState } from "react";

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();

/** Picks up to five distinct main colours from an image's pixels. */
function extract(data: Uint8ClampedArray, count = 5) {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++;
    bk.r += r;
    bk.g += g;
    bk.b += b;
    buckets.set(key, bk);
  }
  const ranked = [...buckets.values()]
    .map((b) => ({ n: b.n, r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }))
    .sort((a, b) => b.n - a.n);
  const picked: typeof ranked = [];
  for (const c of ranked) {
    // Skip colours too close to one already picked, so the strip shows real variety.
    if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 48)) picked.push(c);
    if (picked.length === count) break;
  }
  return picked.map((c) => toHex(c.r, c.g, c.b));
}

/** The cover's main colours as swatches; selecting one copies its hex code. */
export default function Palette({ src, fallback }: { src: string; fallback: string[] }) {
  const [colors, setColors] = useState<string[]>(fallback);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 64, 64);
        const found = extract(ctx.getImageData(0, 0, 64, 64).data);
        if (found.length >= 2) setColors(found);
      } catch {
        // The image host didn't allow reading pixels; keep the stored colours.
      }
    };
    img.src = src;
  }, [src]);

  const copy = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      setTimeout(() => setCopied(""), 1600);
    } catch {}
  };

  return (
    <div className="palette">
      <p className="palette-label">Palette</p>
      <ul>
        {colors.map((hex) => (
          <li key={hex}>
            <button type="button" onClick={() => copy(hex)} aria-label={`Copy ${hex}`}>
              <span className="palette-chip" style={{ backgroundColor: hex }} />
              <span className="palette-hex">{copied === hex ? "Copied" : hex}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
