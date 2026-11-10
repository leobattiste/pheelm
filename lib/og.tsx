import { readFile } from "node:fs/promises";
import { join } from "node:path";

type OgFont = { name: string; data: ArrayBuffer | Buffer; weight: 400 | 700; style: "normal" };

let switzer: Promise<OgFont[] | null> | null = null;

/**
 * Switzer regular and bold from Fontshare, for share images. The image renderer can't read
 * woff2, so this picks the woff (or ttf) files out of Fontshare's stylesheet. Null if Fontshare
 * can't be reached; the images then use Inter.
 */
function loadSwitzer() {
  return (switzer ??= (async () => {
    try {
      const css = await (await fetch("https://api.fontshare.com/v2/css?f[]=switzer@400,700&display=swap", { cache: "force-cache", signal: AbortSignal.timeout(5000) })).text();
      const faces = css.split("@font-face").slice(1);
      const urlFor = (weight: number) => {
        const face = faces.find((f) => new RegExp(`font-weight:\\s*${weight}\\b`).test(f) && !/italic/i.test(f.match(/font-style:\s*([a-z]+)/i)?.[1] ?? ""));
        const urls = [...(face ?? "").matchAll(/url\(['"]?([^'")]+)['"]?\)\s*format\(['"]?([a-z0-9]+)/gi)];
        const pick = urls.find((u) => u[2] === "woff") ?? urls.find((u) => u[2] === "truetype" || u[2] === "opentype");
        return pick ? (pick[1].startsWith("//") ? `https:${pick[1]}` : pick[1]) : null;
      };
      const [r, b] = [urlFor(400), urlFor(700)];
      if (!r || !b) return null;
      const [regular, bold] = await Promise.all([r, b].map(async (u) => (await fetch(u, { cache: "force-cache", signal: AbortSignal.timeout(5000) })).arrayBuffer()));
      return [
        { name: "Switzer", data: regular, weight: 400, style: "normal" },
        { name: "Switzer", data: bold, weight: 700, style: "normal" },
      ] as OgFont[];
    } catch {
      return null;
    }
  })());
}

/**
 * Fonts for the share images: Switzer (with Inter, served from the site, behind it for missing
 * letters, or in its place if Fontshare can't be reached), and Beth Ellen for the wordmark.
 */
export async function ogFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [regular, bold, wordmark, sw] = await Promise.all([
    readFile(join(dir, "Inter-Regular.woff")),
    readFile(join(dir, "Inter-Bold.woff")),
    readFile(join(dir, "BethEllen-Regular.woff")),
    loadSwitzer(),
  ]);
  return [
    ...(sw ?? []),
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Beth Ellen", data: wordmark, weight: 400 as const, style: "normal" as const },
  ];
}

/** The "pheelm" wordmark, in Beth Ellen, for share images. */
export function OgWordmark({ size = 44, color }: { size?: number; color?: string }) {
  return <div style={{ display: "flex", fontFamily: "Beth Ellen", fontSize: size, lineHeight: 1.4, color }}>pheelm</div>;
}
