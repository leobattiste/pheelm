import 'server-only';
import { toCard, toDirectorSummary } from './data';
import { serviceName, watchLink } from './watch';
import { countryName } from './format';
import type { Film, Director } from './types';
import type { SearchEntry } from './catalog-search';
const titles = (f: Film) => [f.title, f.original_title, ...(f.aka ?? [])].filter((s): s is string => !!s);
export function filmSearchEntry(f: Film): SearchEntry {
    return { id: f.id, slug: f.slug, title: f.title, image: f.poster_url, subtitle: f.year + ' • ' + f.directors.map(d => d.name).join(', '),
        aliases: titles(f).slice(1), names: [...new Set(f.credits.map(c => c.person.name))], countries: f.countries, languages: f.languages, genres: f.genres,
        types: [f.type], years: [f.year], runtime: f.runtime, wins: f.awards.filter(a => a.result === 'won').length, nominations: f.awards.filter(a => a.result === 'nominated').length,
        awards: [...new Set(f.awards.map(a => a.award))], availability: f.watch.filter(w => watchLink(w.provider, f.title) || /^https?:\/\//i.test(w.url)).map(w => ({ provider: serviceName(w.provider), region: w.region?.toUpperCase() ?? '', kind: w.kind })), count: 1, filmography: [{ year: f.year, type: f.type }], film: toCard(f) };
}
export function directorSearchEntry(d: Director): SearchEntry {
    const summary = toDirectorSummary(d);
    return { id: d.id, slug: d.slug, title: d.name, image: d.photo_url, subtitle: [d.country ? countryName(d.country) : '', d.films.length + ' films'].filter(Boolean).join(' • '),
        aliases: [...new Set(d.films.flatMap(titles))], names: [], countries: d.country ? [d.country] : [], languages: [], genres: [], types: [...new Set(d.films.map(f => f.type))], years: d.films.map(f => f.year), runtime: null, wins: 0, nominations: 0, awards: [], availability: [], count: d.films.length, filmography: d.films.map(f => ({ year: f.year, type: f.type })), director: summary };
}
