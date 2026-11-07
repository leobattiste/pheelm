"use client";

import Icon from "./Icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { countryName, decadeOf } from "@/lib/format";
import type { FilmCard } from "@/lib/types";
import { FilmGrid } from "./FilmCard";

type Facets = { countries: [string, number][]; decades: [string, number][]; languages: [string, number][]; genres: [string, number][] };
type Sort = "shuffle" | "newest" | "oldest" | "title" | "awards";
const KEYS = ["decade", "country", "language", "genre", "q", "sort"] as const;
type Key = (typeof KEYS)[number];
type State = Partial<Record<Key, string>>;
const FILTERS = ["decade", "country", "language", "genre"] as const;
type Filter = (typeof FILTERS)[number];

const PAGE = 36;
const SORTS: [Sort, string][] = [["shuffle", "Shuffled"], ["newest", "Newest"], ["oldest", "Oldest"], ["title", "A to Z"], ["awards", "Most awarded"]];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const label = (k: Filter, v: string) => (k === "country" ? countryName(v) : v);

/**
 * The Films page: a search bar and a Filters button that opens a modal (a bottom sheet on
 * phones). Every choice is kept in the address, so a filtered view can be shared.
 */
export default function FilmBrowser({ films, facets }: { films: FilmCard[]; facets: Facets }) {
  const [state, setState] = useState<State>({});
  const [shown, setShown] = useState(PAGE);
  // A new random order on every visit, so the same films don't always lead the page.
  const [rank, setRank] = useState<Map<string, number> | null>(null);
  useEffect(() => { setRank(new Map(films.map((f) => [f.id, Math.random()]))); }, [films]);
  const modal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s: State = {};
    for (const k of KEYS) {
      const v = p.get(k);
      if (v) s[k] = v;
    }
    setState(s);
  }, []);

  const commit = (next: State) => {
    setState(next);
    setShown(PAGE);
    const p = new URLSearchParams();
    for (const key of KEYS) if (next[key]) p.set(key, next[key]!);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const set = (k: Key, v: string) => commit({ ...state, [k]: v || undefined });

  const filter = (s: State) => {
    const q = s.q ? plain(s.q.trim()) : "";
    return films.filter(
      (f) =>
        (!s.decade || decadeOf(f.year) === s.decade) &&
        (!s.country || f.countries.includes(s.country)) &&
        (!s.language || f.languages.includes(s.language)) &&
        (!s.genre || f.genres.includes(s.genre)) &&
        (!q || plain(`${f.title} ${f.also ?? ""} ${f.directors.join(" ")}`).includes(q)),
    );
  };

  const results = useMemo(() => {
    // Searches read best newest first; browsing is shuffled.
    const sort = (state.sort as Sort) ?? (state.q?.trim() ? "newest" : "shuffle");
    const by: Record<Sort, (a: FilmCard, b: FilmCard) => number> = {
      shuffle: (a, b) => (rank ? (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) : b.year - a.year),
      newest: (a, b) => b.year - a.year,
      oldest: (a, b) => a.year - b.year,
      title: (a, b) => a.title.localeCompare(b.title),
      awards: (a, b) => b.wins - a.wins || b.year - a.year,
    };
    return filter(state).sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [films, state, rank]);
  const waiting = !rank && !state.sort && !state.q?.trim();

  const active = FILTERS.filter((k) => state[k]);
  // Counts in the modal reflect the other filters already chosen.
  const countFor = (k: Filter, v: string) => filter({ ...state, [k]: v }).length;

  const groups: { key: Filter; title: string; options: string[] }[] = [
    { key: "decade", title: "Decade", options: facets.decades.map(([d]) => d) },
    { key: "country", title: "Country", options: facets.countries.map(([c]) => c).sort((a, b) => countryName(a).localeCompare(countryName(b))) },
    { key: "language", title: "Language", options: facets.languages.map(([l]) => l).sort() },
    { key: "genre", title: "Genre", options: facets.genres.map(([g]) => g).sort() },
  ];

  return (
    <div className="browser">
      <div className="toolbar">
        <label className="search-bar">
          <Icon name="search" />
          <span className="visually-hidden">Search films or directors</span>
          <input type="search" placeholder="Search films" value={state.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
        <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          <Icon name="filter" />
          <span className="filter-label">Filters</span>
          {active.length > 0 && <span className="badge">{active.length}</span>}
        </button>
      </div>

      <div className="result-bar" aria-live="polite">
        {active.length > 0 && (
          <ul className="chip-list">
            {active.map((k) => (
              <li key={k}>
                <button type="button" className="chip" onClick={() => set(k, "")} aria-label={`Remove ${label(k, state[k]!)}`}>
                  {label(k, state[k]!)}
                  <Icon name="close" className="x" />
                </button>
              </li>
            ))}
            <li>
              <button type="button" className="link-button" onClick={() => commit({ q: state.q, sort: state.sort })}>Clear all</button>
            </li>
          </ul>
        )}
      </div>

      {results.length ? (
        <>
          <div className={waiting ? "shuffle-wait" : "shuffle-ready"}><FilmGrid films={results.slice(0, shown)} priority={6} /></div>
          {shown < results.length && (
            <button type="button" className="button ghost more" onClick={() => setShown(shown + PAGE)}>
              Show more
            </button>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Icon name="search" className="empty-icon" />
          <p>No films match your search.</p>
          <p className="muted">
            Try fewer filters, or <a href="/submit">suggest a film</a> we&rsquo;re missing.
          </p>
          <button type="button" className="button ghost small" onClick={() => commit({ sort: state.sort })}>Clear search and filters</button>
        </div>
      )}

      <dialog ref={modal} className="modal" aria-labelledby="filters-title" onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="filters-title">Filters</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <label className="field filter-field">
            Sort by
            <select value={state.sort ?? "shuffle"} onChange={(e) => set("sort", e.target.value === "shuffle" ? "" : e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {groups.map((g) => (
            <label key={g.key} className="field filter-field">
              {g.title}
              <select value={state[g.key] ?? ""} onChange={(e) => set(g.key, e.target.value)}>
                <option value="">Any</option>
                {g.options.map((v) => {
                  const n = countFor(g.key, v);
                  const on = state[g.key] === v;
                  if (!n && !on) return null;
                  return <option key={v} value={v}>{label(g.key, v)} ({n})</option>;
                })}
              </select>
            </label>
          ))}
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => commit({ q: state.q })} disabled={!active.length && !state.sort}>Reset</button>
          <button type="button" className="button" onClick={() => modal.current?.close()}>
            Show {results.length} {results.length === 1 ? "film" : "films"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
