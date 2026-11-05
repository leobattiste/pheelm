import { ImageResponse } from "next/og";
import { getFilm, getFilms } from "@/lib/data";
import { posterColours } from "@/lib/format";
import { SITE_NAME } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getFilms()).map((f) => ({ slug: f.slug }));
}

/** The preview shown when a film is shared: its poster on its own colour, with title and director. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const film = await getFilm((await params).slug);
  if (!film) return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", background: "#17120e" }} />, size);
  const card = posterColours(film.title);
  const directors = film.directors.map((d) => d.name).join(" and ");

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, gap: 64, background: "#0c0c0c", color: "#f5f5f5", fontFamily: "serif" }}>
        <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0))" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, position: "relative" }}>
          <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>{SITE_NAME}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontSize: film.title.length > 28 ? 64 : 84, lineHeight: 1, letterSpacing: -1 }}>{film.title}</div>
            <div style={{ display: "flex", fontSize: 34, opacity: 0.9 }}>{`${directors}, ${film.year}`}</div>
          </div>
        </div>
        {film.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={film.poster_url} width={334} height={502} style={{ borderRadius: 6, position: "relative", objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 334, height: 502, padding: 32, borderRadius: 6, background: card.bg, color: card.fg, position: "relative" }}>
            <div style={{ display: "flex", fontSize: 46, lineHeight: 1 }}>{film.title}</div>
            <div style={{ display: "flex", fontSize: 20 }}>{film.year}</div>
          </div>
        )}
      </div>
    ),
    size,
  );
}
