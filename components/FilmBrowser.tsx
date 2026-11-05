"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countryName, decadeOf, TYPE_PLURALS } from "@/lib/format";
import type { FilmCard, FilmType } from "@/lib/types";
import { FilmGrid } from "./FilmCard";

type Facets = { countries: [string, number][]; decades: [string, number][]; languages: [string, number][]; genres: [string, number][] };
type Sort = "newest" | "oldest" | "title" | "awards";
const KEYS = ["type", "decade", "country", "language", "genre", "q", "sort"] as const;
type Key = (typeof KEYS)[number];
type State = Partial<Record<Key, string>>;
const FILTERS = ["decade", "country", "language", "genre"] as const;

const PAGE = 48;
const TYPES: FilmType[] = ["feature", "documentary", "short", "animation"];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const label = (k: (typeof FILTERS)[number], v: string) => (k === "country" ? countryName(v) : v);

/**
 * The Films page. Type and search sit in view; decade, country, language and genre live in
 * a sheet. Every filter is kept in the address, so a filtered view can be shared.
 */
export default function FilmBrowser({ films, facets }: { films: FilmCard[]; facets: Facets }) {
  const [state, setState] = useState<State>({});
  const [shown, setShown] = useState(PAGE);
  const sheet = useRef<HTMLDialogElement>(null);

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
        (!s.type || f.type === s.type) &&
        (!s.decade || decadeOf(f.year) === s.decade) &&
        (!s.country || f.countries.includes(s.country)) &&
        (!s.language || f.languages.includes(s.language)) &&
        (!s.genre || f.genres.includes(s.genre)) &&
        (!q || plain(`${f.title} ${f.directors.join(" ")}`).includes(q)),
    );
  };

  const results = useMemo(() => {
    const sort = (state.sort as Sort) ?? "newest";
    const by: Record<Sort, (a: FilmCard, b: FilmCard) => number> = {
      newest: (a, b) => b.year - a.year,
      oldest: (a, b) => a.year - b.year,
      title: (a, b) => a.title.localeCompare(b.title),
      awards: (a, b) => b.wins - a.wins || b.year - a.year,
    };
    return filter(state).sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [films, state]);

  const active = FILTERS.filter((k) => state[k]);

  // Counts in the sheet reflect the other filters already chosen.
  const countFor = (k: (typeof FILTERS)[number], v: string) => filter({ ...state, [k]: v }).length;

  const groups: { key: (typeof FILTERS)[number]; title: string; options: [string, number][] }[] = [
    { key: "decade", title: "Decade", options: facets.decades },
    { key: "country", title: "Country", options: [...facets.countries].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))) },
    { key: "language", title: "Language", options: [...facets.languages].sort((a, b) => a[0].localeCompare(b[0])) },
    { key: "genre", title: "Genre", options: [...facets.genres].sort((a, b) => a[0].localeCompare(b[0])) },
  ];

  return (
    <div className="browser">
      <div className="browser-bar">
        <div className="browser-row browser-top" role="group" aria-label="Film type">
          <button type="button" className="chip" aria-pressed={!state.type} onClick={() => set("type", "")}>All</button>
          {TYPES.map((t) => (
            <button key={t} type="button" className="chip" aria-pressed={state.type === t} onClick={() => set("type", state.type === t ? "" : t)}>
              {TYPE_PLURALS[t]}
            </button>
          ))}
        </div>
        <div className="browser-tools">
          <button type="button" className="chip" aria-haspopup="dialog" onClick={() => sheet.current?.showModal()}>
            Filters{active.length > 0 && <span className="count">{active.length}</span>}
          </button>
          <label className="sort">
            <span className="visually-hidden">Sort</span>
            <select value={state.sort ?? "newest"} onChange={(e) => set("sort", e.target.value === "newest" ? "" : e.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">A to Z</option>
              <option value="awards">Most awarded</option>
            </select>
          </label>
        </div>
        <label className="browser-search">
          <span className="visually-hidden">Search titles or directors</span>
          <input type="search" placeholder="Search titles or directors" value={state.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
      </div>

      <div className="result-count" aria-live="polite">
        <span>{results.length} {results.length === 1 ? "film" : "films"}</span>
        {active.length > 0 && (
          <ul className="chip-list">
            {active.map((k) => (
              <li key={k}>
                <button type="button" className="chip" onClick={() => set(k, "")} aria-label={`Remove ${label(k, state[k]!)}`}>
                  {label(k, state[k]!)} <span className="x" aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {results.length ? (
        <>
          <FilmGrid films={results.slice(0, shown)} priority={6} />
          {shown < results.length && (
            <button type="button" className="button ghost more" onClick={() => setShown(shown + PAGE)}>
              Show {Math.min(PAGE, results.length - shown)} more
            </button>
          )}
        </>
      ) : (
        <p className="empty">
          No films match these filters.{" "}
          <button type="button" className="link-button" onClick={() => commit({ sort: state.sort })}>Clear them</button>{" "}
          or <a href="/submit">suggest a film</a>.
        </p>
      )}

      <dialog ref={sheet} className="sheet" aria-labelledby="filters-title" onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }}>
        <div className="sheet-head">
          <h2 id="filters-title">Filters</h2>
          <button type="button" className="link-button" onClick={() => sheet.current?.close()}>Close</button>
        </div>
        <div className="sheet-body">
          {groups.map((g) => (
            <section key={g.key} className="sheet-group" aria-labelledby={`g-${g.key}`}>
              <h3 id={`g-${g.key}`}>{g.title}</h3>
              <ul className="chip-list">
                {g.options.map(([v]) => {
                  const n = countFor(g.key, v);
                  const on = state[g.key] === v;
                  if (!n && !on) return null;
                  return (
                    <li key={v}>
                      <button type="button" className="chip" aria-pressed={on} onClick={() => set(g.key, on ? "" : v)}>
                        {label(g.key, v)} <span className="count">{n}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <div className="sheet-foot">
          <button type="button" className="button ghost" onClick={() => commit({ type: state.type, q: state.q, sort: state.sort })}>Clear</button>
          <button type="button" className="button" onClick={() => sheet.current?.close()}>
            Show {results.length} {results.length === 1 ? "film" : "films"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
