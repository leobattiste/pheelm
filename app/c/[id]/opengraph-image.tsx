import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { getFilms } from "@/lib/data";
import { filmColour, inkFor, posterColours } from "@/lib/format";
import { OgWordmark, ogFonts } from "@/lib/og";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export async function generateStaticParams() {
  return [];
}

type Row = { title: string; staff_pick: boolean; user_id: string; list_films: { film_id: string; added_at: string }[] };

/**
 * The preview shown when a collection is shared: its title, who made it, and a fan of its first
 * posters, on the colour of the lead film. Only public collections are drawn; anything else
 * gets the plain wordmark.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [fonts, films] = await Promise.all([ogFonts(), getFilms()]);

  // Signed out on purpose: a share image only ever shows what anyone could see.
  const db = SUPABASE_URL && SUPABASE_ANON_KEY && /^[0-9a-f-]{36}$/i.test(id) ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  const { data } = db
    ? await db.from("lists").select("title, staff_pick, user_id, list_films(film_id, added_at)").eq("id", id).eq("is_public", true).maybeSingle()
    : { data: null };
  const list = data as Row | null;

  if (!list) {
    return new ImageResponse(
      <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#0b0b0b", color: "#fff" }}>
        <OgWordmark size={96} />
      </div>,
      { ...size, fonts },
    );
  }

  const owner = list.staff_pick || !db ? null : (await db.from("profiles").select("handle").eq("id", list.user_id).maybeSingle()).data as { handle: string } | null;
  const byId = new Map(films.map((f) => [f.id, f]));
  const picks = [...list.list_films]
    .sort((a, b) => list.staff_pick ? (byId.get(a.film_id)?.year ?? 0) - (byId.get(b.film_id)?.year ?? 0) : b.added_at.localeCompare(a.added_at))
    .map((r) => byId.get(r.film_id))
    .filter((f) => f !== undefined);
  // Lead with films that have posters, so the fan isn't all title cards.
  const fan = [...picks.filter((f) => f.poster_url), ...picks.filter((f) => !f.poster_url)].slice(0, 4);
  const bg = fan[0] ? filmColour(fan[0]) : "#0b0b0b";
  const ink = inkFor(bg);
  const long = list.title.length > 30;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", padding: 64, background: bg, color: ink, fontFamily: "Switzer, Inter", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 560 }}>
          <OgWordmark />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 26, opacity: 0.75 }}>{owner ? `A collection by @${owner.handle}` : "A collection on Pheelm"}</div>
            <div style={{ display: "flex", fontSize: long ? 56 : 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{list.title}</div>
          </div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 470 }}>
          {fan.map((f, i) => {
            const place = { position: "absolute" as const, left: i * 82, top: 26 + (i % 2) * 34, width: 224, height: 336, borderRadius: 10, transform: `rotate(${(i - 1.5) * 4}deg)`, boxShadow: "0 24px 48px rgba(0,0,0,0.35)" };
            if (f.poster_url) {
              // eslint-disable-next-line @next/next/no-img-element
              return <img key={f.id} src={f.poster_url} width={224} height={336} style={{ ...place, objectFit: "cover" }} alt="" />;
            }
            const c = posterColours(f.title);
            return (
              <div key={f.id} style={{ ...place, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 20, background: c.bg, color: c.fg }}>
                <div style={{ display: "flex", fontSize: 30, fontWeight: 700, lineHeight: 1.05 }}>{f.title}</div>
                <div style={{ display: "flex", fontSize: 16 }}>{f.year}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
