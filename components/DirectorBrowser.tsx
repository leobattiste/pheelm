"use client";

import Icon from "./Icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { countryName } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";
import DirectorCard from "./DirectorCard";
import { matchScore, plain } from "@/lib/fuzzy";

type Sort = "az" | "films" | "earliest" | "latest";
type State = { q?: string; country?: string; min?: string; sort?: Sort };
const KEYS = ["q", "country", "min", "sort"] as const;

const SORTS: [Sort, string][] = [["films", "Most films"], ["az", "A to Z"], ["earliest", "Earliest"], ["latest", "Most recent"]];
const MINS: [string, string][] = [["", "Any"], ["2", "2 or more"], ["3", "3 or more"]];
const surname = (name: string) => plain(name.split(/\s+/).at(-1) ?? name);

/** The Directors page: search, filters (country, number of films) and sort, shown as profile cards. */
export default function DirectorBrowser({ directors }: { directors: DirectorSummary[] }) {
  const [state, setState] = useState<State>({});
  const modal = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s: State = {};
    for (const k of KEYS) {
      const v = p.get(k);
      if (v) (s as Record<string, string>)[k] = v;
    }
    setState(s);
  }, []);

  const commit = (next: State) => {
    setState(next);
    const p = new URLSearchParams();
    for (const k of KEYS) if (next[k]) p.set(k, next[k]!);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };
  const set = (k: keyof State, v: string) => commit({ ...state, [k]: v || undefined });

  const results = useMemo(() => {
    const q = state.q ? plain(state.q.trim()) : "";
    const min = Number(state.min ?? 0);
    const list = directors.filter(
      (d) => (!q || matchScore(q, plain(d.name)) > 0) && (!state.country || d.country === state.country) && d.films >= min,
    );
    const by: Record<Sort, (a: DirectorSummary, b: DirectorSummary) => number> = {
      az: (a, b) => surname(a.name).localeCompare(surname(b.name)),
      films: (a, b) => b.films - a.films || surname(a.name).localeCompare(surname(b.name)),
      earliest: (a, b) => a.first - b.first,
      latest: (a, b) => b.last - a.last,
    };
    return [...list].sort(by[state.sort ?? "films"]);
  }, [directors, state.q, state.country, state.min, state.sort]);


  const countries = useMemo(
    () => [...new Set(directors.map((d) => d.country).filter((c): c is string => !!c))].sort((a, b) => countryName(a).localeCompare(countryName(b))),
    [directors],
  );
  const active = (["country", "min"] as const).filter((k) => state[k]);
  const label = (k: "country" | "min", v: string) => (k === "country" ? countryName(v) : `${v}+ films`);

  return (
    <div className="browser">
      <div className="toolbar">
        <label className="search-bar">
          <Icon name="search" />
          <span className="visually-hidden">Search directors</span>
          <input type="search" placeholder="Search directors" value={state.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
        <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          <Icon name="filter" />
          <span className="filter-label">Filters</span>
          {active.length > 0 && <span className="badge">{active.length}</span>}
        </button>
      </div>

      <div className="result-bar" aria-live="polite">
        {!!state.q?.trim() && <span className="result-count">{results.length} {results.length === 1 ? "director" : "directors"}</span>}
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
            <li><button type="button" className="link-button" onClick={() => commit({ q: state.q, sort: state.sort })}>Clear all</button></li>
          </ul>
        )}
      </div>


      {results.length ? (
        <ul className="director-grid">
          {results.map((d) => <DirectorCard key={d.id} director={d} />)}
        </ul>
      ) : (
        <div className="empty-state">
          <Icon name="search" className="empty-icon" />
          <p>No directors match your search.</p>
          <button type="button" className="button ghost small" onClick={() => commit({})}>Clear search and filters</button>
        </div>
      )}

      <dialog ref={modal} className="modal" aria-labelledby="dfilters-title" onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="dfilters-title">Filters</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close filters">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <label className="field filter-field">
            <span className="filter-title"><Icon name="sort" />Sort by</span>
            <select value={state.sort ?? "films"} onChange={(e) => set("sort", e.target.value === "films" ? "" : e.target.value)}>
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span className="filter-title"><Icon name="film" />Films in the directory</span>
            <select value={state.min ?? ""} onChange={(e) => set("min", e.target.value)}>
              {MINS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="field filter-field">
            <span className="filter-title"><Icon name="globe" />Country</span>
            <select value={state.country ?? ""} onChange={(e) => set("country", e.target.value)}>
              <option value="">Any</option>
              {countries.map((c) => <option key={c} value={c}>{countryName(c)} ({directors.filter((d) => d.country === c).length})</option>)}
            </select>
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => commit({ q: state.q })} disabled={!active.length && !state.sort}>Reset</button>
          <button type="button" className="button" onClick={() => modal.current?.close()}>
            Show directors
          </button>
        </div>
      </dialog>
    </div>
  );
}
