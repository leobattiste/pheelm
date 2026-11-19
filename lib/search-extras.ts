import { buildFacets, interpretQuery, type SearchEntry } from './catalog-search';
import { countryName } from './format';
import type { UnifiedFilter, UnifiedResult, UnifiedSearchData, UnifiedSearchState } from './unified-search';

const plain = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Why a result matched, when it wasn't simply its name: "Directed by …", "Cast: …", "Also known as …". */
export function matchReason(r: UnifiedResult, query: string): string | null {
  const q = plain(query);
  if (q.length < 2 || plain(r.title).includes(q)) return null;
  const e = r.entry;
  if (e?.film) {
    const director = e.film.directors.find(n => plain(n).includes(q));
    if (director) return 'Directed by ' + director;
    const person = e.names.find(n => plain(n).includes(q));
    if (person) return 'Cast and crew: ' + person;
    const alias = e.aliases.find(n => plain(n).includes(q));
    if (alias) return 'Also known as ' + alias;
    const country = e.countries.find(c => plain(countryName(c)).includes(q));
    if (country) return 'From ' + countryName(country);
    const genre = e.genres.find(g => plain(g).includes(q));
    if (genre) return genre;
    return null;
  }
  if (e?.director) {
    const film = e.aliases.find(n => plain(n).includes(q));
    return film ? 'Directed ' + film : null;
  }
  if (r.watchlist) {
    const owner = r.watchlist.owner;
    if (owner && (plain(owner.handle).includes(q) || plain(owner.display_name ?? '').includes(q))) return 'By @' + owner.handle;
    if (r.watchlist.description && plain(r.watchlist.description).includes(q)) return 'In the description';
    return null;
  }
  if (r.member?.bio && plain(r.member.bio).includes(q)) return 'In their bio';
  return null;
}

type Filters = Partial<Record<UnifiedFilter, string>>;
/** Ways into the catalog that say what Pheelm is about. Only themes with enough films show. */
export const THEMES: { id: string; title: string; filters: Filters }[] = [
  { id: 'nollywood', title: 'Nollywood and Nigerian cinema', filters: { country: 'NG' } },
  { id: 'senegal', title: 'Films from Senegal', filters: { country: 'SN' } },
  { id: 'south-africa', title: 'Films from South Africa', filters: { country: 'ZA' } },
  { id: 'ghana', title: 'Films from Ghana', filters: { country: 'GH' } },
  { id: 'burkina', title: 'Films from Burkina Faso', filters: { country: 'BF' } },
  { id: 'black-british', title: 'Black British cinema', filters: { country: 'GB' } },
  { id: 'caribbean', title: 'Films from Jamaica', filters: { country: 'JM' } },
  { id: 'brazil', title: 'Films from Brazil', filters: { country: 'BR' } },
  { id: 'seventies', title: 'The 1970s', filters: { from: '1970', to: '1979' } },
  { id: 'nineties', title: 'The 1990s', filters: { from: '1990', to: '1999' } },
  { id: 'docs', title: 'Documentaries', filters: { type: 'documentary' } },
  { id: 'shorts', title: 'Short films', filters: { type: 'short' } },
  { id: 'awards', title: 'Award winners', filters: { award: 'won' } },
  { id: 'free', title: 'Free to stream', filters: { availability: 'free' } },
];

/** Plain-English searches ("Nigerian films from the 90s", "short documentaries") turned into filters. */
export function naturalFilters(q: string, films: SearchEntry[]): { q: string; filters: Filters } | null {
  if (q.trim().split(/\s+/).length < 2) return null;
  const parsed = interpretQuery(q, 'films', buildFacets(films));
  if (!parsed) return null;
  const { q: rest, decade, ...others } = parsed;
  const filters: Filters = {};
  for (const [k, v] of Object.entries(others)) if (v) filters[k as UnifiedFilter] = v;
  if (decade) { filters.from = decade.slice(0, 4); filters.to = String(+decade.slice(0, 4) + 9); }
  return Object.keys(filters).length ? { q: rest ?? '', filters } : null;
}

/** For signed-in members: films by directors they follow, and films people they follow have saved. */
export function recommendations(data: UnifiedSearchData) {
  const followedNames = new Set(data.directors.filter(d => data.followedDirectorIds?.includes(d.id)).map(d => d.title));
  const byFollowed = followedNames.size
    ? data.films.filter(f => f.film?.directors.some(n => followedNames.has(n))).sort((a, b) => Math.max(...b.years) - Math.max(...a.years)).slice(0, 12)
    : [];
  const followedMembers = new Set(data.members.filter(m => m.following).map(m => m.id));
  const counts = new Map<string, number>();
  for (const list of data.watchlists) if (list.is_public && list.owner && followedMembers.has(list.owner.id)) for (const id of list.filmIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const fromPeople = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).flatMap(([id]) => data.films.find(f => f.id === id) ?? []);
  const sample = data.directors.find(d => data.followedDirectorIds?.includes(d.id))?.title;
  return { byFollowed, fromPeople, sample };
}

export const SERVICES_KEY = 'pheelm:services:v1';
