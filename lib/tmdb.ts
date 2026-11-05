import "server-only";
import type { Role, WatchOption } from "./types";

/**
 * TMDB (themoviedb.org) fills in posters, synopses, cast and crew, trailers and where to watch.
 * It switches on when TMDB_API_KEY is set: either the short "API Key" or the long "API Read Access Token".
 * TMDB's terms require the credit line shown in the site footer.
 */
const KEY = process.env.TMDB_API_KEY ?? "";
export const tmdbEnabled = Boolean(KEY);

// Countries whose streaming options are imported. Change with TMDB_WATCH_REGIONS="US,GB,FR".
const REGIONS = (process.env.TMDB_WATCH_REGIONS ?? "US,GB,FR,CA").split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);

const IMG = "https://image.tmdb.org/t/p";

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  // The long token goes in a header; the short key goes in the address.
  if (KEY.length > 40) headers.authorization = `Bearer ${KEY}`;
  else url.searchParams.set("api_key", KEY);
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 401) throw new Error("TMDB rejected the API key. Check TMDB_API_KEY in Vercel.");
  if (res.status === 429) throw new Error("TMDB asked us to slow down. Wait a minute and try again.");
  if (!res.ok) throw new Error(`TMDB returned ${res.status} for ${path}.`);
  return res.json() as Promise<T>;
}

export type SearchResult = { id: number; title: string; original_title: string; year: number | null; poster: string | null; overview: string };

export async function searchMovies(query: string, year?: number): Promise<SearchResult[]> {
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.year = String(year);
  let data = await get<{ results: any[] }>("/search/movie", params);
  // Release years differ between festivals and theatres, so retry without one.
  if (!data.results.length && year) data = await get<{ results: any[] }>("/search/movie", { query, include_adult: "false" });
  return data.results.slice(0, 8).map((r) => ({
    id: r.id,
    title: r.title,
    original_title: r.original_title,
    year: r.release_date ? Number(r.release_date.slice(0, 4)) : null,
    poster: r.poster_path ? `${IMG}/w185${r.poster_path}` : null,
    overview: r.overview ?? "",
  }));
}

/** Finds the TMDB film that matches a title, year and director, checking credits to avoid remakes and namesakes. */
export async function findMovie(title: string, year: number, directors: string[]): Promise<number | null> {
  const results = await searchMovies(title, year);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const wanted = new Set(directors.map(norm));
  const close = results.filter((r) => !r.year || Math.abs(r.year - year) <= 2).slice(0, 4);
  for (const r of close) {
    if (!wanted.size) return r.id;
    const credits = await get<{ crew: any[] }>(`/movie/${r.id}/credits`);
    if (credits.crew.some((c) => c.job === "Director" && wanted.has(norm(c.name)))) return r.id;
  }
  return null;
}

export type ImportedPerson = { tmdb_id: number; name: string; role: Role; character: string | null; photo: string | null };

export type ImportedFilm = {
  tmdb_id: number;
  title: string;
  original_title: string | null;
  year: number | null;
  runtime: number | null;
  synopsis: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  trailer_url: string | null;
  genres: string[];
  countries: string[];
  languages: string[];
  people: ImportedPerson[];
  watch: WatchOption[];
};

// TMDB job titles kept for each role. The exact job ("Co-Director", "Screenplay", "Story") is
// saved with the credit so film pages can say who did what.
const CREW_JOBS: Record<string, Role> = {
  Director: "director",
  "Co-Director": "director",
  Story: "writer",
  Screenplay: "writer",
  Writer: "writer",
  "Original Music Composer": "composer",
  Music: "composer",
  "Director of Photography": "cinematographer",
  Editor: "editor",
  Producer: "producer",
};

export async function getMovie(id: number): Promise<ImportedFilm> {
  const m = await get<any>(`/movie/${id}`, { append_to_response: "credits,videos,watch/providers", language: "en-US" });

  const people: ImportedPerson[] = [];
  const seen = new Set<string>();
  const add = (p: any, role: Role, character: string | null = null) => {
    const key = `${p.id}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    people.push({ tmdb_id: p.id, name: p.name, role, character, photo: p.profile_path ? `${IMG}/w185${p.profile_path}` : null });
  };
  for (const role of ["director", "writer", "cinematographer", "editor", "composer", "producer"] as Role[]) {
    const crew = (m.credits?.crew ?? []).filter((c: any) => CREW_JOBS[c.job] === role);
    for (const c of role === "producer" ? crew.slice(0, 3) : crew) add(c, role, c.job ?? null);
  }
  for (const c of (m.credits?.cast ?? []).slice(0, 12)) add(c, "cast", c.character || null);

  const videos: any[] = (m.videos?.results ?? []).filter((v: any) => v.site === "YouTube" && v.type === "Trailer");
  const trailer = videos.find((v) => v.official) ?? videos[0];

  const watch: WatchOption[] = [];
  const providers = m["watch/providers"]?.results ?? {};
  const kinds: [string, WatchOption["kind"]][] = [["flatrate", "stream"], ["free", "free"], ["ads", "free"], ["rent", "rent"], ["buy", "buy"]];
  for (const region of REGIONS) {
    const r = providers[region];
    if (!r) continue;
    for (const [key, kind] of kinds) {
      for (const p of r[key] ?? []) {
        if (!watch.some((w) => w.provider === p.provider_name && w.region === region && w.kind === kind)) {
          // TMDB gives one JustWatch page per country, listing every option for the film.
          watch.push({ provider: p.provider_name, url: r.link, kind, region });
        }
      }
    }
  }

  return {
    tmdb_id: m.id,
    title: m.title,
    original_title: m.original_title && m.original_title !== m.title ? m.original_title : null,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    runtime: m.runtime || null,
    synopsis: m.overview || null,
    poster_url: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
    backdrop_url: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    genres: (m.genres ?? []).map((g: any) => g.name),
    countries: (m.production_countries ?? []).map((c: any) => c.iso_3166_1),
    languages: (m.spoken_languages ?? []).map((l: any) => l.english_name || l.name).filter(Boolean),
    people,
    watch,
  };
}

export async function getPersonDetails(id: number) {
  const p = await get<any>(`/person/${id}`);
  return {
    bio: p.biography || null,
    birth_year: p.birthday ? Number(p.birthday.slice(0, 4)) : null,
    photo_url: p.profile_path ? `${IMG}/w300${p.profile_path}` : null,
  };
}
