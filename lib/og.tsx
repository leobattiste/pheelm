import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Fonts for the share images (they can't use the site's woff2 files): Nacelle regular and bold,
 * and Beth Ellen for the wordmark.
 */
export async function ogFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [regular, bold, wordmark] = await Promise.all([
    readFile(join(dir, "Nacelle-Regular.ttf")),
    readFile(join(dir, "Nacelle-Bold.ttf")),
    readFile(join(dir, "BethEllen-Regular.woff")),
  ]);
  return [
    { name: "Nacelle", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Nacelle", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Beth Ellen", data: wordmark, weight: 400 as const, style: "normal" as const },
  ];
}

/** The "pheelm" wordmark, in Beth Ellen, for share images. */
export function OgWordmark({ size = 44, color }: { size?: number; color?: string }) {
  return <div style={{ display: "flex", fontFamily: "Beth Ellen", fontSize: size, lineHeight: 1.4, color }}>pheelm</div>;
}
