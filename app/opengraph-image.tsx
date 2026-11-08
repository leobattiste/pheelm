import { ImageResponse } from "next/og";
import { getFilms } from "@/lib/data";
import { posterColours } from "@/lib/format";
import { OgWordmark, ogFonts } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Discover films by Black directors.";
export const revalidate = 3600;

/** The site's share preview: the name, the tagline and a fan of featured films' title cards. */
export default async function Image() {
  const [all, fonts] = await Promise.all([getFilms(), ogFonts()]);
  const films = all.filter((f) => f.featured).slice(0, 4);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 72, background: "#0b0b0b", color: "#fafafa", fontFamily: "Switzer, Inter", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <OgWordmark size={52} />
          <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>Discover films by Black directors.</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 420 }}>
          {films.map((f, i) => {
            const c = posterColours(f.title);
            const place = { position: "absolute" as const, left: i * 70, top: 40 + (i % 2) * 30, width: 200, height: 300, borderRadius: 20, transform: `rotate(${(i - 1.5) * 4}deg)` };
            if (f.poster_url) {
              // eslint-disable-next-line @next/next/no-img-element
              return <img key={f.id} src={f.poster_url} width={200} height={300} style={{ ...place, objectFit: "cover" }} alt="" />;
            }
            return (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", position: "absolute", left: i * 70, top: 40 + (i % 2) * 30, width: 200, height: 300, padding: 18, borderRadius: 20, background: c.bg, color: c.fg, transform: `rotate(${(i - 1.5) * 4}deg)` }}>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>{f.title}</div>
                <div style={{ display: "flex", fontSize: 14 }}>{f.year}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
