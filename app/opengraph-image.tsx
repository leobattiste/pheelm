import { ImageResponse } from "next/og";
import { getFilms } from "@/lib/data";
import { posterColours } from "@/lib/format";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = SITE_TAGLINE;
export const revalidate = 3600;

/** The site's share preview: the name, the tagline and a fan of featured films' title cards. */
export default async function Image() {
  const films = (await getFilms()).filter((f) => f.featured).slice(0, 4);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, background: "#17120e", color: "#f2ece3", fontFamily: "serif", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <div style={{ display: "flex", fontSize: 96, letterSpacing: -2 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", fontSize: 46, lineHeight: 1.1 }}>{SITE_TAGLINE}</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 420 }}>
          {films.map((f, i) => {
            const c = posterColours(f.title);
            return (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "absolute", left: i * 70, top: 40 + (i % 2) * 30, width: 200, height: 300, padding: 18, borderRadius: 4, background: c.bg, color: c.fg, transform: `rotate(${(i - 1.5) * 4}deg)` }}>
                <div style={{ display: "flex", fontSize: 28, lineHeight: 1 }}>{f.title}</div>
                <div style={{ display: "flex", fontSize: 14 }}>{f.year}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    size,
  );
}
