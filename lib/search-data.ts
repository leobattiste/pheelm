import 'server-only';
import { toCard, toDirectorSummary } from './data';
import { serviceName, watchLink } from './watch';
import type { Film, Director } from './types';
import { unpack, type PackedEntry, type SearchEntry } from './catalog-search';
const titles = (f: Film) => [f.title, f.original_title, ...(f.aka ?? [])].filter((s): s is string => !!s);
/** What a film sends to the browser: its card, plus only the extras the search and filters need. */
/**
 * Which themes and studios the Films page can filter by: those shared by enough films. Anything
 * rarer stays off the page, so it isn't sent to every visitor.
 */
export function filterVocabulary(films: Film[]) {
    const tally = (xs: string[], min: number) => {
        const n = new Map<string, number>();
        for (const x of xs) n.set(x, (n.get(x) ?? 0) + 1);
        return new Set([...n].filter(([, c]) => c >= min).map(([x]) => x));
    };
    return { themes: tally(films.flatMap(f => f.keywords ?? []), 6), studios: tally(films.flatMap(f => f.companies ?? []), 4) };
}
export type FilterVocabulary = ReturnType<typeof filterVocabulary>;
export function packFilm(f: Film, vocab?: FilterVocabulary): PackedEntry {
    const th = (f.keywords ?? []).filter(k => !vocab || vocab.themes.has(k));
    const st = (f.companies ?? []).filter(c => !vocab || vocab.studios.has(c));
    // Search matches up to eight other titles per film.
    return { f: toCard(f), also: titles(f).slice(1, 9), names: [...new Set(f.credits.map(c => c.person.name))],
        nominations: f.awards.filter(a => a.result === 'nominated').length, awards: [...new Set(f.awards.map(a => a.award))],
        availability: f.watch.filter(w => watchLink(w.provider, f.title) || /^https?:\/\//i.test(w.url)).map(w => ({ provider: serviceName(w.provider), region: w.region?.toUpperCase() ?? '', kind: w.kind })),
        added: f.created_at ? Date.parse(f.created_at) || 0 : 0,
        // Only what a filter can use, and only when present, so the page stays small.
        ...(th.length ? { th } : {}),
        ...(f.certification && (!f.certification_country || f.certification_country === 'US') ? { r: f.certification } : {}),
        ...(st.length ? { st } : {}),
        ...(f.series ? { se: f.series.name } : {}) };
}

export const filmSearchEntry = (f: Film): SearchEntry => unpack(packFilm(f));
/** The same for a director: their card, their films' titles to search by, and the years they worked. */
export function packDirector(d: Director): PackedEntry {
    return { d: toDirectorSummary(d), also: [...new Set(d.films.flatMap(titles))],
        filmography: d.films.map(f => ({ year: f.year, type: f.type })),
        wins: d.films.reduce((n, f) => n + (f.awards ?? []).filter(a => a.result === 'won').length, 0),
        added: d.created_at ? Date.parse(d.created_at) || 0 : 0 };
}

export const directorSearchEntry = (d: Director): SearchEntry => unpack(packDirector(d));
