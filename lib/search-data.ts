import 'server-only';
import { toCard, toDirectorSummary } from './data';
import { serviceName, watchLink } from './watch';
import type { Film, Director } from './types';
import { unpack, type PackedEntry, type SearchEntry } from './catalog-search';
const titles = (f: Film) => [f.title, f.original_title, ...(f.aka ?? [])].filter((s): s is string => !!s);
/** What a film sends to the browser: its card, plus only the extras the search and filters need. */
export function packFilm(f: Film): PackedEntry {
    return { f: toCard(f), also: titles(f).slice(1), names: [...new Set(f.credits.map(c => c.person.name))],
        nominations: f.awards.filter(a => a.result === 'nominated').length, awards: [...new Set(f.awards.map(a => a.award))],
        availability: f.watch.filter(w => watchLink(w.provider, f.title) || /^https?:\/\//i.test(w.url)).map(w => ({ provider: serviceName(w.provider), region: w.region?.toUpperCase() ?? '', kind: w.kind })),
        added: f.created_at ? Date.parse(f.created_at) || 0 : 0 };
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
