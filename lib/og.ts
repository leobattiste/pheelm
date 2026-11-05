import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Nacelle, regular and bold, for the share images (they can't use the site's woff2 files). */
export async function ogFonts() {
  const dir = join(process.cwd(), "assets/fonts");
  const [regular, bold] = await Promise.all([readFile(join(dir, "Nacelle-Regular.ttf")), readFile(join(dir, "Nacelle-Bold.ttf"))]);
  return [
    { name: "Nacelle", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Nacelle", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}
