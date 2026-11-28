import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { COUNTRIES, countryName } from "@/lib/format";
import { discoverMovies, tmdbEnabled, TMDB_GENRES, type DiscoverResult } from "@/lib/tmdb";
import { Empty, PageHeader, Panel } from "../../ui";
import QueueButton from "./QueueButton";

export const dynamic = "force-dynamic";

const DECADES = Array.from({ length: 11 }, (_, i) => 2020 - i * 10);
const LANGUAGES: [string, string][] = [
  ["en", "English"], ["fr", "French"], ["pt", "Portuguese"], ["es", "Spanish"], ["yo", "Yoruba"], ["ig", "Igbo"], ["ha", "Hausa"], ["wo", "Wolof"],
  ["sw", "Swahili"], ["am", "Amharic"], ["zu", "Zulu"], ["xh", "Xhosa"], ["ar", "Arabic"], ["ht", "Haitian Creole"], ["bm", "Bambara"], ["ln", "Lingala"],
];

/**
 * Find missing films: TMDB's Discover, most-voted first, with anything already on Pheelm left out.
 * TMDB can't say who is a Black director, so each result shows its director to judge by; "Add to
 * queue" saves it to the film queue, where it's checked and added like any other.
 */
export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { db } = await requireAdmin("/admin/films/discover");
  const sp = await searchParams;
  const country = sp.country && /^[A-Z]{2}$/.test(sp.country) ? sp.country : "";
  const decade = sp.decade && /^\d{4}$/.test(sp.decade) ? Number(sp.decade) : 0;
  const genre = sp.genre && /^\d+$/.test(sp.genre) ? Number(sp.genre) : 0;
  const language = sp.language && /^[a-z]{2}$/.test(sp.language) ? sp.language : "";
  const page = Math.max(1, Math.min(20, Number(sp.page) || 1));
  const asked = Boolean(country || decade || genre || language);

  let results: DiscoverResult[] = [];
  let pages = 1;
  let error = "";
  let queued = new Set<string>();
  if (asked && tmdbEnabled) {
    try {
      const r = await discoverMovies({ country, decade, genre, language, page });
      pages = r.pages;
      const ids = r.results.map((m) => m.id);
      const [{ data: have }, { data: inQueue }] = await Promise.all([
        db.from("films").select("tmdb_id").in("tmdb_id", ids),
        db.from("film_queue").select("title, year").in("title", r.results.map((m) => m.title)),
      ]);
      const known = new Set((have ?? []).map((f) => f.tmdb_id));
      queued = new Set((inQueue ?? []).map((q) => `${q.title}|${q.year ?? ""}`));
      results = r.results.filter((m) => !known.has(m.id));
    } catch (e) {
      error = e instanceof Error ? e.message : "TMDB didn't answer. Try again in a moment.";
    }
  }
  const link = (p: number) => `/admin/films/discover?${new URLSearchParams(Object.entries({ country, decade: decade ? String(decade) : "", genre: genre ? String(genre) : "", language, page: String(p) }).filter(([, v]) => v)).toString()}`;
  const countries = Object.keys(COUNTRIES).sort((a, b) => countryName(a).localeCompare(countryName(b)));

  return (
    <>
      <PageHeader back={{ href: "/admin/films", label: "Films" }} title="Find missing films"
        description="Films on TMDB that aren't on Pheelm yet, most-voted first. Check each director, then add the ones that belong to the queue." />
      <Panel title="Look for" icon="search">
        <form method="get" className="admin-discover-form">
          <label className="field">Country
            <select name="country" defaultValue={country}><option value="">Any</option>{countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}</select>
          </label>
          <label className="field">Decade
            <select name="decade" defaultValue={decade ? String(decade) : ""}><option value="">Any</option>{DECADES.map((d) => <option key={d} value={d}>{d}s</option>)}</select>
          </label>
          <label className="field">Genre
            <select name="genre" defaultValue={genre ? String(genre) : ""}><option value="">Any</option>{TMDB_GENRES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          </label>
          <label className="field">Original language
            <select name="language" defaultValue={language}><option value="">Any</option>{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
          </label>
          <button type="submit" className="button">Search TMDB</button>
        </form>
      </Panel>
      {!tmdbEnabled ? <Empty title="TMDB isn't connected">Add TMDB_API_KEY in Vercel to use this page.</Empty>
        : !asked ? <Empty title="Pick at least one">Choose a country, decade, genre or language to see what&apos;s missing.</Empty>
        : error ? <p className="notice error">{error}</p>
        : !results.length ? <Empty title="Nothing missing on this page">Every film here is already on Pheelm. Try the next page or another search.</Empty>
        : (
          <Panel title={`Page ${page} of ${pages}`} icon="film">
            <ul className="admin-discover">
              {results.map((m) => (
                <li key={m.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.poster ? <img src={m.poster} alt="" loading="lazy" /> : <span className="admin-discover-blank" />}
                  <div>
                    <a href={`https://www.themoviedb.org/movie/${m.id}`} target="_blank" rel="noopener noreferrer"><strong>{m.title}</strong></a>
                    <span className="muted">{[m.year, m.directors.join(", ") || "Director unknown", `${m.votes.toLocaleString("en-US")} votes`].filter(Boolean).join(" · ")}</span>
                    {m.overview && <p className="muted">{m.overview.slice(0, 180)}{m.overview.length > 180 ? "…" : ""}</p>}
                  </div>
                  <QueueButton title={m.title} year={m.year} queued={queued.has(`${m.title}|${m.year ?? ""}`)} />
                </li>
              ))}
            </ul>
            <div className="pagination-controls">
              {page > 1 && <Link className="button ghost" href={link(page - 1)}>Previous</Link>}
              {page < pages && <Link className="button ghost" href={link(page + 1)}>Next page</Link>}
            </div>
          </Panel>
        )}
    </>
  );
}
