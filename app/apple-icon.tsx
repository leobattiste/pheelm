import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the wordmark's "p" in Beth Ellen, white on black. */
export default async function AppleIcon() {
  const font = await readFile(join(process.cwd(), "assets/fonts/BethEllen-Regular.woff"));
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff" }}>
        <div style={{ display: "flex", fontFamily: "Beth Ellen", fontSize: 150, lineHeight: 1, marginTop: -145, marginLeft: 5 }}>p</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Beth Ellen", data: font, weight: 400, style: "normal" }] },
  );
}
