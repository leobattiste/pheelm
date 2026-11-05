"use client";

import { useEffect, useMemo, useState } from "react";
import { countryName, decadeOf, TYPE_PLURALS } from "@/lib/format";
import type { FilmCard, FilmType } from "@/lib/types";
import { FilmGrid } from "./FilmCard";

type Facets = { countries: [string, number][]; decades: [string, number][]; languages: [string, number][]; genres: [string, number][] };
type Sort = "newest" | "oldest" | "title" | "awards";
const KEYS = ["type", "decade", "country", "language", "genre", "q", "sort"] as const;
type State = Partial<Record<(typeof KEYS)[number], string>>;

const PAGE = 48;
const TYPES: FilmType[] = ["feature", "documentary", "short", "animation"];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The Films page: every filter lives in the address, so a filtered view can be shared. */
export default function FilmBrowser({ films, facets }: { films: FilmCard[]; facets: Facets }) {
  const [state, setState] = useState<State>({});
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s: State = {};
    for (const k of KEYS) {
      const v = p.get(k);
      if (v) s[k] = v;
    }
    setState(s);
  }, []);

  const set = (k: keyof State, v: string) => {
    const next = { ...state, [k]: v || undefined };
    setState(next);
    setShown(PAGE);
    const p = new URLSearchParams();
    for (const key of KEYS) if (next[key]) p.set(key, next[key]!);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const results = useMemo(() => {
    const q = state.q ? plain(state.q.trim()) : "";
    const list = films.filter(
      (f) =>
        (!state.type || f.type === state.type) &&
        (!state.decade || decadeOf(f.year) === state.decade) &&
        (!state.country || f.countries.includes(state.country)) &&
        (!state.language || f.languages.includes(state.language)) &&
        (!state.genre || f.genres.includes(state.genre)) &&
        (!q || plain(`${f.title} ${f.directors.join(" ")}`).includes(q)),
    );
    const sort = (state.sort as Sort) ?? "newest";
    const by: Record<Sort, (a: FilmCard, b: FilmCard) => number> = {
      newest: (a, b) => b.year - a.year,
      oldest: (a, b) => a.year - b.year,
      title: (a, b) => a.title.localeCompare(b.title),
      awards: (a, b) => b.wins - a.wins || b.year - a.year,
    };
    return [...list].sort(by[sort]);
  }, [films, state]);

  const active = KEYS.filter((k) => k !== "sort" && k !== "type" && state[k]).length;

  return (
    <div className="browser">
      <div className="type-tabs" role="tablist" aria-label="Film type">
        <button role="tab" aria-selected={!state.type} onClick={() => set("type", "")}>
          All
        </button>
        {TYPES.map((t) => (
          <button key={t} role="tab" aria-selected={state.type === t} onClick={() => set("type", t)}>
            {TYPE_PLURALS[t]}
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="search">
          <span className="visually-hidden">Search films or directors</span>
          <input type="search" placeholder="Search titles or directors" value={state.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
        <Select label="Decade" value={state.decade} onChange={(v) => set("decade", v)} options={facets.decades.map(([d, n]) => [d, `${d} (${n})`])} />
        <Select label="Country" value={state.country} onChange={(v) => set("country", v)}
          options={[...facets.countries].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))).map(([c, n]) => [c, `${countryName(c)} (${n})`])} />
        <Select label="Language" value={state.language} onChange={(v) => set("language", v)}
          options={[...facets.languages].sort((a, b) => a[0].localeCompare(b[0])).map(([l, n]) => [l, `${l} (${n})`])} />
        <Select label="Genre" value={state.genre} onChange={(v) => set("genre", v)}
          options={[...facets.genres].sort((a, b) => a[0].localeCompare(b[0])).map(([g, n]) => [g, `${g} (${n})`])} />
        <Select label="Sort" value={state.sort ?? "newest"} onChange={(v) => set("sort", v === "newest" ? "" : v)} required
          options={[["newest", "Newest first"], ["oldest", "Oldest first"], ["title", "A to Z"], ["awards", "Most awarded"]]} />
      </div>

      <p className="result-count" aria-live="polite">
        {results.length} {results.length === 1 ? "film" : "films"}
        {active > 0 && (
          <button type="button" className="link-button" onClick={() => { setState({ type: state.type, sort: state.sort }); window.history.replaceState(null, "", window.location.pathname); }}>
            Clear filters
          </button>
        )}
      </p>

      {results.length ? (
        <>
          <FilmGrid films={results.slice(0, shown)} priority={8} />
          {shown < results.length && (
            <button type="button" className="button more" onClick={() => setShown(shown + PAGE)}>
              Show more
            </button>
          )}
        </>
      ) : (
        <p className="empty">No films match these filters yet.</p>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, required }: {
  label: string; value?: string; onChange: (v: string) => void; options: [string, string][]; required?: boolean;
}) {
  return (
    <label className="select">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {!required && <option value="">Any</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
