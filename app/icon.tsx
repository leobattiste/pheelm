import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The favicon: the "p" of the wordmark, in Beth Ellen, white on black. */
export default async function Icon() {
  const font = await readFile(join(process.cwd(), "assets/fonts/BethEllen-Regular.woff"));
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#000", color: "#fff", borderRadius: 16 }}>
        {/* Beth Ellen's "p" sits low in its box; this centres the letter itself. */}
        <div style={{ display: "flex", fontFamily: "Beth Ellen", fontSize: 58, lineHeight: 1, marginTop: -56, marginLeft: 2 }}>p</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Beth Ellen", data: font, weight: 400, style: "normal" }] },
  );
}
