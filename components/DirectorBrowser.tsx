"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countryName } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";
import DirectorCard from "./DirectorCard";

type Sort = "az" | "films" | "earliest" | "latest";
type State = { q?: string; country?: string; min?: string; sort?: Sort };
const KEYS = ["q", "country", "min", "sort"] as const;

const SORTS: [Sort, string][] = [["az", "A to Z"], ["films", "Most films"], ["earliest", "Earliest"], ["latest", "Most recent"]];
const MINS: [string, string][] = [["", "Any"], ["2", "2 or more"], ["3", "3 or more"]];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
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
      (d) => (!q || plain(d.name).includes(q)) && (!state.country || d.country === state.country) && d.films >= min,
    );
    const by: Record<Sort, (a: DirectorSummary, b: DirectorSummary) => number> = {
      az: (a, b) => surname(a.name).localeCompare(surname(b.name)),
      films: (a, b) => b.films - a.films || surname(a.name).localeCompare(surname(b.name)),
      earliest: (a, b) => a.first - b.first,
      latest: (a, b) => b.last - a.last,
    };
    return [...list].sort(by[state.sort ?? "az"]);
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
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="m13 13 4 4" /></svg>
          <span className="visually-hidden">Search directors</span>
          <input type="search" placeholder="Search directors" value={state.q ?? ""} onChange={(e) => set("q", e.target.value)} />
        </label>
        <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => modal.current?.showModal()}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M6 10h8M8.5 14h3" /></svg>
          <span className="filter-label">Filters</span>
          {active.length > 0 && <span className="badge">{active.length}</span>}
        </button>
      </div>

      <div className="result-bar" aria-live="polite">
        <span className="result-count">{results.length} {results.length === 1 ? "director" : "directors"}</span>
        {active.length > 0 && (
          <ul className="chip-list">
            {active.map((k) => (
              <li key={k}>
                <button type="button" className="chip" onClick={() => set(k, "")} aria-label={`Remove ${label(k, state[k]!)}`}>
                  {label(k, state[k]!)}
                  <svg className="x" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8M14 6l-8 8" /></svg>
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
          <p>No directors match your search.</p>
          <button type="button" className="button ghost small" onClick={() => commit({})}>Clear search and filters</button>
        </div>
      )}

      <dialog ref={modal} className="modal" aria-labelledby="dfilters-title" onClick={(e) => { if (e.target === modal.current) modal.current?.close(); }}>
        <div className="modal-head">
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id="dfilters-title">Filters</h2>
          <button type="button" className="icon-button" onClick={() => modal.current?.close()} aria-label="Close filters">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="modal-body">
          <section className="filter-group" aria-labelledby="dg-sort">
            <h3 id="dg-sort">Sort by</h3>
            <ul className="chip-list">
              {SORTS.map(([v, l]) => (
                <li key={v}><button type="button" className="chip" aria-pressed={(state.sort ?? "az") === v} onClick={() => set("sort", v === "az" ? "" : v)}>{l}</button></li>
              ))}
            </ul>
          </section>
          <section className="filter-group" aria-labelledby="dg-min">
            <h3 id="dg-min">Films in the directory</h3>
            <ul className="chip-list">
              {MINS.map(([v, l]) => (
                <li key={l}><button type="button" className="chip" aria-pressed={(state.min ?? "") === v} onClick={() => set("min", v)}>{l}</button></li>
              ))}
            </ul>
          </section>
          <section className="filter-group" aria-labelledby="dg-country">
            <h3 id="dg-country">Country</h3>
            <ul className="chip-list">
              {countries.map((c) => {
                const n = directors.filter((d) => d.country === c).length;
                return <li key={c}><button type="button" className="chip" aria-pressed={state.country === c} onClick={() => set("country", state.country === c ? "" : c)}>{countryName(c)} <span className="count">{n}</span></button></li>;
              })}
            </ul>
          </section>
        </div>
        <div className="modal-foot">
          <button type="button" className="button ghost" onClick={() => commit({ q: state.q })} disabled={!active.length && !state.sort}>Reset</button>
          <button type="button" className="button" onClick={() => modal.current?.close()}>
            Show {results.length} {results.length === 1 ? "director" : "directors"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
