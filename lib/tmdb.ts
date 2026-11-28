import "server-only";
import type { Role, WatchOption } from "./types";

/**
 * TMDB (themoviedb.org) fills in posters, synopses, cast and crew, trailers and where to watch.
 * It switches on when TMDB_API_KEY is set: either the short "API Key" or the long "API Read Access Token".
 * TMDB's terms require the credit line shown in the site footer.
 */
const KEY = process.env.TMDB_API_KEY ?? "";
export const tmdbEnabled = Boolean(KEY);

// The country whose streaming options are imported. Film pages show one country, so only one
// is needed. Change with TMDB_WATCH_REGIONS="GB".
const REGIONS = (process.env.TMDB_WATCH_REGIONS ?? "US").split(",").map((r) => r.trim().toUpperCase()).filter(Boolean);

const IMG = "https://image.tmdb.org/t/p";

// The parts of TMDB's responses read here. TMDB leaves fields out freely, so most are optional.
type TmdbSearchMovie = { id: number; title: string; original_title: string; release_date?: string; poster_path?: string | null; overview?: string };
type TmdbCredit = { id: number; name: string; profile_path?: string | null; job?: string; character?: string };
type TmdbVideo = { site?: string; key?: string; type?: string; official?: boolean };
type TmdbProvider = { provider_name: string; logo_path?: string | null };
type TmdbRegionProviders = { link: string } & Partial<Record<"flatrate" | "free" | "ads" | "rent" | "buy", TmdbProvider[]>>;
type TmdbMovie = {
  id: number;
  imdb_id?: string | null;
  title: string;
  original_title?: string;
  release_date?: string;
  runtime?: number | null;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
  production_countries?: { iso_3166_1: string }[];
  spoken_languages?: { english_name?: string; name?: string }[];
  credits?: { crew?: TmdbCredit[]; cast?: TmdbCredit[] };
  videos?: { results?: TmdbVideo[] };
  "watch/providers"?: { results?: Record<string, TmdbRegionProviders> };
};
type TmdbPerson = {
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  known_for_department?: string | null;
  imdb_id?: string | null;
  profile_path?: string | null;
  external_ids?: { imdb_id?: string | null; instagram_id?: string | null };
};

async function get<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = { accept: "application/json" };
  // The long token goes in a header; the short key goes in the address.
  if (KEY.length > 40) headers.authorization = `Bearer ${KEY}`;
  else url.searchParams.set("api_key", KEY);
  const res = await fetch(url, { headers, cache: "no-store", signal });
  if (res.status === 401) throw new Error("TMDB rejected the API key. Check TMDB_API_KEY in Vercel.");
  if (res.status === 429) throw new Error("TMDB asked us to slow down. Wait a minute and try again.");
  if (!res.ok) throw new Error(`TMDB returned ${res.status} for ${path}.`);
  return res.json() as Promise<T>;
}

export type SearchResult = { id: number; title: string; original_title: string; year: number | null; poster: string | null; overview: string };

export async function searchMovies(query: string, year?: number): Promise<SearchResult[]> {
  const params: Record<string, string> = { query, include_adult: "false" };
  if (year) params.year = String(year);
  let data = await get<{ results: TmdbSearchMovie[] }>("/search/movie", params);
  // Release years differ between festivals and theatres, so retry without one.
  if (!data.results.length && year) data = await get<{ results: TmdbSearchMovie[] }>("/search/movie", { query, include_adult: "false" });
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
export async function findMovie(title: string, year: number, directors: string[], opts: { partial?: boolean } = {}): Promise<number | null> {
  const results = await searchMovies(title, year);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const wanted = directors.map(norm).filter(Boolean);
  // Exact full names, or (partial) a surname that appears in the director's name.
  const matches = (name: string) => (opts.partial ? wanted.some((w) => norm(name).includes(w)) : wanted.includes(norm(name)));
  const close = results.filter((r) => !r.year || Math.abs(r.year - year) <= 2).slice(0, opts.partial ? 6 : 4);
  for (const r of close) {
    if (!wanted.length) return r.id;
    const credits = await get<{ crew: TmdbCredit[] }>(`/movie/${r.id}/credits`);
    if (credits.crew.some((c) => c.job === "Director" && matches(c.name))) return r.id;
  }
  return null;
}

/**
 * Finds a film through its director instead of its title: the director's TMDB directing credits,
 * within two years of `year`, best title match first, then nearest year. For films TMDB lists under
 * another title (a translation, the original language).
 */
export async function findByDirector(director: string, title: string, year: number): Promise<number | null> {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const people = await get<{ results: { id: number; name: string; known_for_department?: string }[] }>("/search/person", { query: director, include_adult: "false" });
  const want = norm(title);
  for (const person of people.results.slice(0, 3)) {
    const credits = await get<{ crew: { id: number; job: string; title: string; original_title: string; release_date?: string }[] }>(`/person/${person.id}/movie_credits`);
    const films = credits.crew
      .filter((c) => c.job === "Director" && c.release_date)
      .map((c) => ({ id: c.id, y: Number(c.release_date!.slice(0, 4)), names: [norm(c.title), norm(c.original_title)] }))
      .filter((c) => Math.abs(c.y - year) <= 2);
    if (!films.length) continue;
    const titled = films.find((c) => c.names.some((n) => n && (n === want || n.includes(want) || want.includes(n))));
    if (titled) return titled.id;
    // One film in those years can only be this one.
    if (films.length === 1) return films[0].id;
    const sameYear = films.filter((c) => c.y === year);
    if (sameYear.length === 1) return sameYear[0].id;
  }
  return null;
}

export type ImportedPerson = { tmdb_id: number; name: string; role: Role; character: string | null; photo: string | null };

export type ImportedFilm = {
  tmdb_id: number;
  imdb_id?: string | null;
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

/** The best YouTube video to offer as a trailer: an official trailer, else a trailer, else a teaser. */
function pickTrailer(results: unknown): { key: string } | null {
  const videos = (Array.isArray(results) ? (results as TmdbVideo[]) : []).filter((v): v is TmdbVideo & { key: string } => v?.site === "YouTube" && !!v?.key);
  for (const type of ["Trailer", "Teaser"]) {
    const ofType = videos.filter((v) => v.type === type);
    const best = ofType.find((v) => v.official) ?? ofType[0];
    if (best) return best;
  }
  return null;
}

export async function getMovie(id: number): Promise<ImportedFilm> {
  const m = await get<TmdbMovie>(`/movie/${id}`, { append_to_response: "credits,videos,watch/providers", language: "en-US" });

  const people: ImportedPerson[] = [];
  const seen = new Set<string>();
  const add = (p: TmdbCredit, role: Role, character: string | null = null) => {
    const key = `${p.id}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    people.push({ tmdb_id: p.id, name: p.name, role, character, photo: p.profile_path ? `${IMG}/w185${p.profile_path}` : null });
  };
  for (const role of ["director", "writer", "cinematographer", "editor", "composer", "producer"] as Role[]) {
    const crew = (m.credits?.crew ?? []).filter((c) => !!c.job && CREW_JOBS[c.job] === role);
    for (const c of crew) add(c, role, c.job ?? null);
  }
  // Everyone TMDB lists, in billing order. The film page shows the crew and the first six of the
  // cast, with the rest behind "Show all".
  for (const c of m.credits?.cast ?? []) add(c, "cast", c.character || null);

  // The request above asks TMDB for English, which also filters the videos it appends, so a film
  // whose trailer is tagged Yoruba, Wolof, French or Portuguese looked as if it had none. When
  // nothing turns up, ask for that film's videos again in every language.
  let trailer = pickTrailer(m.videos?.results);
  if (!trailer) trailer = pickTrailer((await get<{ results?: TmdbVideo[] }>(`/movie/${id}/videos`).catch(() => null))?.results);

  const watch = parseWatch(m["watch/providers"]?.results ?? {});

  return {
    tmdb_id: m.id,
    imdb_id: m.imdb_id || null,
    title: m.title,
    original_title: m.original_title && m.original_title !== m.title ? m.original_title : null,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    runtime: m.runtime || null,
    synopsis: m.overview || null,
    poster_url: m.poster_path ? `${IMG}/w500${m.poster_path}` : null,
    backdrop_url: m.backdrop_path ? `${IMG}/w1280${m.backdrop_path}` : null,
    trailer_url: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
    genres: (m.genres ?? []).map((g) => g.name),
    countries: (m.production_countries ?? []).map((c) => c.iso_3166_1),
    languages: (m.spoken_languages ?? []).map((l) => l.english_name || l.name).filter((l): l is string => !!l),
    people,
    watch,
  };
}

export async function getPersonDetails(id: number) {
  const p = await get<TmdbPerson>(`/person/${id}`, { append_to_response: "external_ids" });
  return {
    bio: p.biography || null,
    birth_year: p.birthday ? Number(p.birthday.slice(0, 4)) : null,
    born: p.birthday || null,
    died: p.deathday || null,
    birthplace: p.place_of_birth || null,
    known_for: p.known_for_department || null,
    imdb_id: p.external_ids?.imdb_id || p.imdb_id || null,
    instagram: p.external_ids?.instagram_id || null,
    photo_url: p.profile_path ? `${IMG}/w300${p.profile_path}` : null,
  };
}

/**
 * Where to watch, from TMDB's providers list: each service per country and kind, with its logo.
 * TMDB gives one page per country listing every option; film pages link each service to a
 * search for the film on that service instead (lib/watch.ts).
 */
function parseWatch(providers: Record<string, TmdbRegionProviders>): WatchOption[] {
  const watch: WatchOption[] = [];
  const kinds: ["flatrate" | "free" | "ads" | "rent" | "buy", WatchOption["kind"]][] = [["flatrate", "stream"], ["free", "free"], ["ads", "free"], ["rent", "rent"], ["buy", "buy"]];
  for (const region of REGIONS) {
    const r = providers[region];
    if (!r) continue;
    for (const [key, kind] of kinds) {
      for (const p of r[key] ?? []) {
        if (!watch.some((w) => w.provider === p.provider_name && w.region === region && w.kind === kind)) {
          watch.push({
            provider: p.provider_name,
            url: r.link,
            kind,
            region,
            ...(p.logo_path ? { logo: `https://image.tmdb.org/t/p/w92${p.logo_path}` } : {}),
          });
        }
      }
    }
  }
  return watch;
}

const NOT_A_FILM = /(the play|\blive\b|in concert|concert for|making (of|the)|video collection|\bvol(ume)?\.? ?\d|special|behind the scenes|comedy jam|all def|sesame street|young indiana jones|pavarotti|^(dave chappelle|chappelle's|katt williams|bernie mac|cedric the entertainer|ms\. pat|bill cosby|amanda seales|mo amer|earthquake|jerrod carmichael|john leguizamo|eddie murphy|kevin hart|chris rock|robert townsend: partners)\b|anniversary|: the reunion|^untold:)/i;

/** Released films a person directed, with a poster (TMDB lists plenty of unfinished or posterless entries). */
export async function getDirectedMovies(personId: number, minVotes = 20): Promise<{ id: number; title: string; year: number }[]> {
  const r = await get<{ crew?: { id: number; job: string; title: string; release_date?: string; poster_path?: string | null; adult?: boolean; vote_count?: number }[] }>(`/person/${personId}/movie_credits`, { language: "en-US" }, AbortSignal.timeout(8000));
  const today = new Date().toISOString().slice(0, 10);
  const seen = new Set<number>();
  return (r.crew ?? []).flatMap((m) => {
    if (m.job !== "Director" || m.adult || !m.poster_path || !m.release_date || m.release_date > today || seen.has(m.id)) return [];
    // Films people actually watch: enough TMDB votes, and not a recorded special, concert, stage
    // play, TV episode or featurette, which TMDB also files under a director's films.
    if ((m.vote_count ?? 0) < minVotes || NOT_A_FILM.test(m.title)) return [];
    seen.add(m.id);
    return [{ id: m.id, title: m.title, year: Number(m.release_date.slice(0, 4)) }];
  });
}

const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The TMDB person with exactly this name who is known for directing, or null when unclear. */
export async function findDirector(name: string): Promise<{ id: number; name: string } | null> {
  const r = await get<{ results?: { id: number; name: string; known_for_department?: string; popularity?: number }[] }>("/search/person", { query: name, include_adult: "false" }, AbortSignal.timeout(8000));
  const same = (r.results ?? []).filter((p) => plain(p.name) === plain(name));
  const directing = same.filter((p) => p.known_for_department === "Directing");
  // Exactly one director by that name, or one person by that name at all: anything else is ambiguous.
  const pick = directing.length === 1 ? directing[0] : same.length === 1 ? same[0] : null;
  return pick ? { id: pick.id, name: pick.name } : null;
}

/** The film's IMDb id from TMDB, or null. */
export async function getImdbId(id: number): Promise<string | null> {
  try { const r = await get<{ imdb_id?: string | null }>(`/movie/${id}/external_ids`, {}, AbortSignal.timeout(6000)); return r.imdb_id || null; } catch { return null; }
}

/** Just a film's where-to-watch options, for refreshing them without a full import. */

export async function getWatch(id: number): Promise<WatchOption[]> {
  const data = await get<{ results?: Record<string, TmdbRegionProviders> }>(`/movie/${id}/watch/providers`);
  return parseWatch(data.results ?? {});
}

/**
 * Asks TMDB, with our key, whether it serves a film's awards anywhere in its API. TMDB shows awards
 * on its website, but its API docs don't list them, so this tries the likely addresses and reports
 * what each one answers. Nothing is saved. Used by the check in Admin > Automation.
 */
export async function probeTmdbAwards(id: number): Promise<{ path: string; status: number | string; found: boolean; sample: string }[]> {
  const tries: { path: string; v: 3 | 4; params?: Record<string, string>; pick?: (j: Record<string, unknown>) => unknown }[] = [
    { path: `/movie/${id}/awards`, v: 3 },
    { path: `/movie/${id}`, v: 3, params: { append_to_response: "awards" }, pick: (j) => Object.fromEntries(Object.entries(j).filter(([k]) => /award|nominat|accolade/i.test(k))) },
    { path: `/movie/${id}/award_nominations`, v: 3 },
    { path: `/movie/${id}/nominations`, v: 3 },
    { path: `/movie/${id}/accolades`, v: 3 },
    { path: `/movie/${id}/awards`, v: 4 },
  ];
  const out: { path: string; status: number | string; found: boolean; sample: string }[] = [];
  for (const t of tries) {
    const url = new URL(`https://api.themoviedb.org/${t.v}${t.path}`);
    for (const [k, v] of Object.entries(t.params ?? {})) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: "application/json" };
    if (KEY.length > 40) headers.authorization = `Bearer ${KEY}`;
    else if (t.v === 3) url.searchParams.set("api_key", KEY);
    const label = `v${t.v}${t.path}${t.params ? `?${new URLSearchParams(t.params)}` : ""}`;
    try {
      const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
      const text = await res.text();
      let body: unknown = text;
      try { body = JSON.parse(text); } catch { /* not JSON */ }
      const picked = t.pick && body && typeof body === "object" ? t.pick(body as Record<string, unknown>) : body;
      const sample = (typeof picked === "string" ? picked : JSON.stringify(picked)).slice(0, 600);
      const found = res.ok && (t.pick ? sample !== "{}" : true);
      out.push({ path: label, status: res.status, found, sample });
    } catch (e) {
      out.push({ path: label, status: e instanceof Error ? e.message : "failed", found: false, sample: "" });
    }
  }
  return out;
}

/** The extra details Pheelm shows for a film, from one TMDB request. */
export type TmdbExtras = {
  keywords: string[];
  certification: string | null;
  certification_country: string | null;
  series: { tmdb_id: number; name: string } | null;
  logo_url: string | null;
  stills: string[];
  companies: string[];
  tagline: string | null;
  budget: number | null;
  revenue: number | null;
  tmdb_recs: number[];
  titles: string[];
};

// Keywords that say nothing about what a film is about (credits scenes, sources, formats, who made it).
const NOISE = /^(aftercreditsstinger|duringcreditsstinger|woman director|black director|female director|based on .*|remake|sequel|prequel|biography|3d|imax|duringcreditsstinger|short film|anthology|independent film|black and white|silent film|live action and animation|dogme 95)$/i;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export async function getExtras(id: number): Promise<TmdbExtras> {
  type Img = { file_path: string; iso_639_1?: string | null; vote_average?: number };
  const m = await get<{
    original_language?: string;
    tagline?: string; budget?: number; revenue?: number;
    belongs_to_collection?: { id: number; name: string } | null;
    production_companies?: { name: string }[];
    keywords?: { keywords?: { name: string }[] };
    release_dates?: { results?: { iso_3166_1: string; release_dates?: { certification?: string; type?: number }[] }[] };
    images?: { logos?: Img[]; backdrops?: Img[] };
    recommendations?: { results?: { id: number }[] };
    similar?: { results?: { id: number }[] };
    alternative_titles?: { titles?: { title: string }[] };
    translations?: { translations?: { data?: { title?: string } }[] };
  }>(`/movie/${id}`, {
    append_to_response: "keywords,release_dates,images,recommendations,similar,alternative_titles,translations",
    include_image_language: "en,null,fr,pt,es,de,it",
    language: "en-US",
  });

  // Age rating: the US one, else the first country that has one.
  const rated = (m.release_dates?.results ?? [])
    .map((r) => ({ country: r.iso_3166_1, cert: (r.release_dates ?? []).map((d) => d.certification?.trim()).find(Boolean) ?? null }))
    .filter((r) => r.cert);
  const cert = rated.find((r) => r.country === "US") ?? rated[0] ?? null;

  // The title logo in English if there is one, else the film's own language, else any.
  const logos = [...(m.images?.logos ?? [])].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0));
  const logo = logos.find((l) => l.iso_639_1 === "en") ?? logos.find((l) => l.iso_639_1 === m.original_language) ?? logos[0];
  const logoUrl = logo ? `${IMG}/${logo.file_path.endsWith(".svg") ? "original" : "w500"}${logo.file_path}` : null;

  // Stills: the best-voted backdrops without text on them.
  const stills = [...(m.images?.backdrops ?? [])]
    .filter((b) => !b.iso_639_1)
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .slice(0, 8)
    .map((b) => `${IMG}/w1280${b.file_path}`);

  const recs = [...(m.recommendations?.results ?? []), ...(m.similar?.results ?? [])].map((r) => r.id);
  const titles = [
    ...(m.alternative_titles?.titles ?? []).map((t) => t.title),
    ...(m.translations?.translations ?? []).map((t) => t.data?.title ?? ""),
  ].map((t) => t.trim()).filter(Boolean);

  return {
    keywords: [...new Set((m.keywords?.keywords ?? []).map((k) => k.name.trim()).filter((k) => k && !NOISE.test(k)).map(cap))].slice(0, 15),
    certification: cert?.cert ?? null,
    certification_country: cert?.country ?? null,
    series: m.belongs_to_collection ? { tmdb_id: m.belongs_to_collection.id, name: m.belongs_to_collection.name.replace(/\s+-\s+Collection$|\s+Collection$/i, "") } : null,
    logo_url: logoUrl,
    stills,
    companies: [...new Set((m.production_companies ?? []).map((c) => c.name.trim()).filter(Boolean))].slice(0, 6),
    tagline: m.tagline?.trim() || null,
    budget: m.budget && m.budget > 0 ? m.budget : null,
    revenue: m.revenue && m.revenue > 0 ? m.revenue : null,
    tmdb_recs: [...new Set(recs)].slice(0, 40),
    titles: [...new Set(titles)],
  };
}
