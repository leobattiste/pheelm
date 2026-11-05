import { ImageResponse } from "next/og";
import { getFilm, getFilms } from "@/lib/data";
import { filmColour, inkFor, posterColours } from "@/lib/format";
import { ogFonts } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getFilms()).map((f) => ({ slug: f.slug }));
}

/**
 * The preview shown when a film is shared: set like the film page, on the film's own colour,
 * in Nacelle, with the poster on the right.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [film, fonts] = await Promise.all([getFilm((await params).slug), ogFonts()]);
  if (!film) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#0b0b0b" }} />, { ...size, fonts });

  const bg = filmColour(film);
  const ink = inkFor(bg);
  const card = posterColours(film.title);
  const directors = film.directors.map((d) => d.name).join(" and ");
  const long = film.title.length > 26;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, gap: 64, background: bg, color: ink, fontFamily: "Nacelle" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 32 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", fontSize: long ? 60 : 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{film.title}</div>
            <div style={{ display: "flex", fontSize: 32, opacity: 0.75 }}>{`${directors}, ${film.year}`}</div>
          </div>
        </div>
        {film.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={film.poster_url} width={334} height={502} style={{ borderRadius: 10, objectFit: "cover", boxShadow: "0 30px 60px rgba(0,0,0,0.35)" }} alt="" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 334, height: 502, padding: 32, borderRadius: 10, background: card.bg, color: card.fg, boxShadow: "0 30px 60px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{film.title}</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18 }}>
              <span>{directors}</span>
              <span>{film.year}</span>
            </div>
          </div>
        )}
      </div>
    ),
    { ...size, fonts },
  );
}
