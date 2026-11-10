import { filmShuffleRank } from "./film-shuffle";
import { plain, matchScore, distance } from './fuzzy';
import { parseQuery } from './query';
import { countryName } from './format';
import type { FilmCard, DirectorSummary } from './types';
export type SearchEntry = {
    id: string;
    slug: string;
    title: string;
    image: string | null;
    subtitle: string;
    aliases: string[];
    names: string[];
    countries: string[];
    languages: string[];
    genres: string[];
    types: string[];
    years: number[];
    runtime: number | null;
    wins: number;
    nominations: number;
    awards: string[];
    availability: {
        provider: string;
        region: string;
        kind: string;
    }[];
    count: number;
    filmography: {
        year: number;
        type: string;
    }[];
    film?: FilmCard;
    director?: DirectorSummary;
};
export const SEARCH_KEYS = ['q', 'sort', 'country', 'decade', 'language', 'genre', 'type', 'year', 'from', 'to', 'minRuntime', 'maxRuntime', 'award', 'festival', 'provider', 'region', 'access', 'min'] as const;
export type SearchKey = typeof SEARCH_KEYS[number];
export type SearchState = Partial<Record<SearchKey, string>>;
export type SearchMode = 'films' | 'directors';
export const FILM_FILTERS: SearchKey[] = ['country', 'decade', 'year', 'language', 'genre', 'type', 'minRuntime', 'maxRuntime', 'award', 'festival', 'provider', 'region', 'access'];
export const DIRECTOR_FILTERS: SearchKey[] = ['country', 'type', 'from', 'to', 'min'];
export const TYPE_LABELS: Record<string, string> = { feature: 'Feature', documentary: 'Documentary', short: 'Short', animation: 'Animation' };
export const SORTS: Record<SearchMode, [
    string,
    string
][]> = {
    films: [['relevance', 'Best match'], ['shuffle', 'Shuffled'], ['newest', 'Newest'], ['oldest', 'Oldest'], ['title', 'A to Z'], ['awards', 'Most awarded']],
    directors: [['relevance', 'Best match'], ['films', 'Most films'], ['az', 'A to Z'], ['earliest', 'Earliest film'], ['latest', 'Latest film']],
};
const normalized = (s: string) => plain(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b));
export function buildFacets(entries: SearchEntry[]) {
    return {
        country: unique(entries.flatMap(e => e.countries)),
        decade: unique(entries.flatMap(e => e.years.map(y => Math.floor(y / 10) * 10 + 's'))),
        language: unique(entries.flatMap(e => e.languages)), genre: unique(entries.flatMap(e => e.genres)),
        type: unique(entries.flatMap(e => e.types)), festival: unique(entries.flatMap(e => e.awards)),
        provider: unique(entries.flatMap(e => e.availability.map(w => w.provider))),
        region: unique(entries.flatMap(e => e.availability.map(w => w.region))),
    };
}
export type SearchFacets = ReturnType<typeof buildFacets>;
export function cleanState(params: URLSearchParams, mode: SearchMode): SearchState {
    const s: SearchState = {};
    const allowed = new Set<SearchKey>(['q', 'sort', ...(mode === 'films' ? FILM_FILTERS : DIRECTOR_FILTERS)]);
    for (const k of SEARCH_KEYS) {
        const v = params.get(k)?.trim().slice(0, k === 'q' ? 200 : 120);
        if (!v || !allowed.has(k))
            continue;
        if (['year', 'from', 'to'].includes(k) && (!/^\d{4}$/.test(v) || +v < 1890 || +v > 2199))
            continue;
        if (['minRuntime', 'maxRuntime', 'min'].includes(k) && (!/^\d{1,4}$/.test(v) || +v < 1))
            continue;
        if (k === 'sort' && !SORTS[mode].some(([id]) => id === v))
            continue;
        if (k === 'type' && !TYPE_LABELS[v])
            continue;
        if (k === 'award' && !['won', 'nominated'].includes(v))
            continue;
        if (k === 'access' && !['stream', 'rent', 'buy', 'free'].includes(v))
            continue;
        s[k] = v;
    }
    return s;
}
export function stateQuery(state: SearchState) {
    const p = new URLSearchParams();
    for (const k of SEARCH_KEYS)
        if (state[k])
            p.set(k, state[k]!);
    return p.toString();
}
export function filterLabel(k: SearchKey, v: string) {
    if (k === 'country' || k === 'region')
        return (k === 'region' ? 'Watch in ' : '') + countryName(v);
    if (k === 'type')
        return TYPE_LABELS[v] ?? v;
    if (k === 'minRuntime')
        return 'At least ' + v + ' min';
    if (k === 'maxRuntime')
        return 'Up to ' + v + ' min';
    if (k === 'from')
        return 'Films from ' + v;
    if (k === 'to')
        return 'Films through ' + v;
    if (k === 'min')
        return v + '+ films';
    if (k === 'award')
        return v === 'won' ? 'Award winners' : 'Award nominees';
    if (k === 'access')
        return ({ stream: 'Streaming', rent: 'Rent', buy: 'Buy', free: 'Free to watch' })[v] ?? v;
    return v;
}
export function matchesFilters(e: SearchEntry, s: SearchState, mode: SearchMode) {
    if (s.country && !e.countries.includes(s.country))
        return false;
    if (mode === 'directors')
        return e.count >= Number(s.min ?? 0) && e.filmography.some(f => (!s.type || f.type === s.type) && (!s.from || f.year >= +s.from) && (!s.to || f.year <= +s.to));
    if (s.type && !e.types.includes(s.type) || s.language && !e.languages.includes(s.language) || s.genre && !e.genres.includes(s.genre))
        return false;
    if (s.decade && !e.years.some(y => Math.floor(y / 10) * 10 + 's' === s.decade) || s.year && !e.years.includes(+s.year))
        return false;
    if (s.minRuntime && (e.runtime === null || e.runtime < +s.minRuntime) || s.maxRuntime && (e.runtime === null || e.runtime > +s.maxRuntime))
        return false;
    if (s.award === 'won' && !e.wins || s.award === 'nominated' && !e.nominations || s.festival && !e.awards.includes(s.festival))
        return false;
    // Provider, region and access must describe the same viewing option.
    if ((s.provider || s.region || s.access) && !e.availability.some(w => (!s.provider || w.provider === s.provider) && (!s.region || w.region === s.region) && (!s.access || w.kind === s.access)))
        return false;
    return true;
}
export function indexEntries(entries: SearchEntry[]) {
    return entries.map(entry => ({ entry, title: normalized(entry.title), aliases: entry.aliases.map(normalized), names: entry.names.map(normalized), all: normalized([entry.title, ...entry.aliases, ...entry.names, ...entry.countries.map(countryName), ...entry.genres, ...entry.languages].join(' ')) }));
}
export type IndexedEntry = ReturnType<typeof indexEntries>[number];
export function relevance(index: IndexedEntry, query: string) {
    const q = normalized(query);
    if (!q)
        return 1;
    if (index.title === q || index.title.replace(/ /g, '') === q.replace(/ /g, ''))
        return 1000;
    if (index.aliases.some(n => n === q || n.replace(/ /g, '') === q.replace(/ /g, '')))
        return 900;
    if (index.title.startsWith(q))
        return 800;
    if (index.title.includes(q))
        return 750;
    if (matchScore(q, index.title) === 2)
        return 700;
    if (index.names.some(n => n === q || n.replace(/ /g, '') === q.replace(/ /g, '')))
        return 650;
    if (index.aliases.some(n => n.includes(q)))
        return 600;
    if (index.names.some(n => n.includes(q)))
        return 550;
    if (matchScore(q, index.title) === 1)
        return 450;
    const score = matchScore(q, index.all);
    return score === 2 ? 350 : score === 1 ? 200 : 0;
}
export function searchEntries(index: IndexedEntry[], state: SearchState, mode: SearchMode, shuffleSeed = 0) {
    const q = state.q ?? '';
    const sort = state.sort ?? (q ? 'relevance' : mode === 'films' ? 'shuffle' : 'films');
    return index.filter(i => matchesFilters(i.entry, state, mode)).map(i => ({ entry: i.entry, score: relevance(i, q) })).filter(r => r.score > 0).sort((a, b) => {
        if (sort === 'relevance' && q && a.score !== b.score)
            return b.score - a.score;
        if (sort === 'shuffle')
            return filmShuffleRank(a.entry.id, shuffleSeed) - filmShuffleRank(b.entry.id, shuffleSeed) || a.entry.id.localeCompare(b.entry.id);
        if (sort === 'newest' || sort === 'latest')
            return Math.max(...b.entry.years) - Math.max(...a.entry.years) || a.entry.title.localeCompare(b.entry.title);
        if (sort === 'oldest' || sort === 'earliest')
            return Math.min(...a.entry.years) - Math.min(...b.entry.years) || a.entry.title.localeCompare(b.entry.title);
        if (sort === 'films')
            return b.entry.count - a.entry.count || a.entry.title.localeCompare(b.entry.title);
        if (sort === 'awards')
            return b.entry.wins - a.entry.wins || a.entry.title.localeCompare(b.entry.title);
        return a.entry.title.localeCompare(b.entry.title);
    });
}
/** Interpret only on request; never silently replace a literal film title. */
export function interpretQuery(input: string, mode: SearchMode, facets: SearchFacets): SearchState | null {
    let text = plain(input).replace(/-/g, ' ').trim();
    const filters: SearchState = {};
    const remove = (re: RegExp, fn: (m: RegExpMatchArray) => void) => { const m = text.match(re); if (m) {
        fn(m);
        text = text.replace(m[0], ' ');
    } };
    if (mode === 'films') {
        remove(/\b(?:under|less than)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/, m => filters.maxRuntime = String(Math.max(1, +m[1] - 1)));
        remove(/\b(?:up to|at most)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/, m => filters.maxRuntime = m[1]);
        remove(/\b(?:over|more than)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/, m => filters.minRuntime = String(+m[1] + 1));
        remove(/\b(?:at least)\s+(\d{1,3})\s*(?:minutes?|mins?)\b/, m => filters.minRuntime = m[1]);
        remove(/\b(?:between)\s+(\d{1,3})\s+and\s+(\d{1,3})\s*(?:minutes?|mins?)\b/, m => { filters.minRuntime = m[1]; filters.maxRuntime = m[2]; });
        remove(/\b(?:award winning|award winners?|oscar winning)\b/, m => { filters.award = 'won'; if (m[0].startsWith('oscar'))
            filters.festival = facets.festival.find(f => /academy awards?|oscars?/i.test(f)) ?? 'Academy Awards'; });
        remove(/\b(?:award nominated|award nominees?)\b/, () => filters.award = 'nominated');
        remove(/\b(?:free to watch|watch for free)\b/, () => filters.access = 'free');
        remove(/\bstreaming\b/, () => filters.access = 'stream');
        remove(/\b(?:available to rent|for rent)\b/, () => filters.access = 'rent');
        remove(/\b(?:available to buy|to purchase)\b/, () => filters.access = 'buy');
        for (const language of [...facets.language].sort((a, b) => b.length - a.length)) {
            const needle = text.includes(' in ' + plain(language)) ? ' in ' + plain(language) : plain(language) + ' language';
            if (text.includes(needle)) {
                filters.language = language;
                text = text.replace(needle, ' ');
                break;
            }
        }
        for (const provider of [...facets.provider].sort((a, b) => b.length - a.length)) {
            const needle = ' on ' + plain(provider);
            if (text.includes(needle)) {
                filters.provider = provider;
                text = text.replace(needle, ' ');
                break;
            }
        }
        remove(/\b(?:available|watch) in ([a-z]{2})\b/, m => { const region = m[1].toUpperCase(); filters.region = region; });
    }
    else {
        remove(/\bbefore\s+((?:19|20)\d{2})\b/, m => filters.to = String(+m[1] - 1));
        remove(/\bafter\s+((?:19|20)\d{2})\b/, m => filters.from = String(+m[1] + 1));
        remove(/\b(?:active\s+)?between\s+((?:19|20)\d{2})\s+and\s+((?:19|20)\d{2})\b/, m => { filters.from = m[1]; filters.to = m[2]; });
        remove(/\b(?:at least\s+)?(\d+)\+?\s+(?:or more\s+)?films\b/, m => filters.min = m[1]);
    }
    const type = text.match(/\b(shorts?|features?|animated|animation|documentar(?:y|ies))\b/);
    if (type) {
        filters.type = type[1].startsWith('short') ? 'short' : type[1].startsWith('feature') ? 'feature' : type[1].startsWith('doc') ? 'documentary' : 'animation';
        text = text.replace(type[0], ' ');
    }
    const parsed = parseQuery(text);
    if (parsed.country)
        filters.country = parsed.country;
    if (mode === 'films') {
        if (parsed.genre)
            filters.genre = parsed.genre;
        if (parsed.decade)
            filters.decade = parsed.decade;
        if (parsed.year)
            filters.year = String(parsed.year);
    }
    else {
        if (parsed.decade) {
            filters.from = parsed.decade.slice(0, 4);
            filters.to = String(+filters.from + 9);
        }
        if (parsed.year) {
            filters.from = String(parsed.year);
            filters.to = String(parsed.year);
        }
    }
    if (!Object.keys(filters).length || parsed.women)
        return null;
    // Unsupported phrases remain literal rather than being silently discarded.
    if (mode === 'directors' && parsed.genre)
        return null;
    filters.q = parsed.rest || undefined;
    return filters;
}
/** A conservative correction for empty searches, without relaxing any filters. */
export function spellingCorrection(index: IndexedEntry[], query: string): string | null {
    const q = normalized(query);
    if (q.length < 4 || q.length > 80)
        return null;
    const max = q.length >= 8 ? 3 : 2;
    let best = max + 1;
    let answer: string | null = null;
    for (const item of index)
        for (const candidate of [item.title, ...item.aliases]) {
            const d = distance(q, candidate, max);
            if (d > 0 && d < best) {
                best = d;
                answer = item.entry.title;
            }
        }
    return answer;
}
