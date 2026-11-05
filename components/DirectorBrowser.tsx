"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countryName } from "@/lib/format";
import type { DirectorSummary } from "@/lib/types";
import DirectorCard from "./DirectorCard";

type MapCountry = { code: string | null; name: string; d: string };
type Sort = "az" | "films" | "earliest" | "latest";
type View = "cards" | "map";
type State = { q?: string; country?: string; era?: string; min?: string; sort?: Sort; view?: View };
const KEYS = ["q", "country", "era", "min", "sort", "view"] as const;

const SORTS: [Sort, string][] = [["az", "A to Z"], ["films", "Most films"], ["earliest", "Earliest"], ["latest", "Most recent"]];
const MINS: [string, string][] = [["", "Any"], ["2", "2 or more"], ["3", "3 or more"]];
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const surname = (name: string) => plain(name.split(/\s+/).at(-1) ?? name);

/**
 * The Directors page: search, filters (country, era, number of films) and sort, shown as cards
 * or on a world map where each country is shaded by how many directors come from it.
 */
export default function DirectorBrowser({ directors, map, mapWidth, mapHeight }: {
  directors: DirectorSummary[];
  map: MapCountry[];
  mapWidth: number;
  mapHeight: number;
}) {
  const [state, setState] = useState<State>({});
  const [hover, setHover] = useState<{ name: string; count: number; x: number; y: number } | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);

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

  // Everything except the country filter, so the map can show where the others come from.
  const base = useMemo(() => {
    const q = state.q ? plain(state.q.trim()) : "";
    const min = Number(state.min ?? 0);
    return directors.filter(
      (d) => (!q || plain(d.name).includes(q)) && (!state.era || d.decades.includes(state.era)) && d.films >= min,
    );
  }, [directors, state.q, state.era, state.min]);

  const results = useMemo(() => {
    const list = base.filter((d) => !state.country || d.country === state.country);
    const by: Record<Sort, (a: DirectorSummary, b: DirectorSummary) => number> = {
      az: (a, b) => surname(a.name).localeCompare(surname(b.name)),
      films: (a, b) => b.films - a.films || surname(a.name).localeCompare(surname(b.name)),
      earliest: (a, b) => a.first - b.first,
      latest: (a, b) => b.last - a.last,
    };
    return [...list].sort(by[state.sort ?? "az"]);
  }, [base, state.country, state.sort]);

  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of base) if (d.country) m.set(d.country, (m.get(d.country) ?? 0) + 1);
    return m;
  }, [base]);
  const maxCount = Math.max(1, ...byCountry.values());
  const onMap = new Set(map.map((c) => c.code));
  const offMap = [...byCountry.keys()].filter((c) => !onMap.has(c));

  const countries = useMemo(
    () => [...new Set(directors.map((d) => d.country).filter((c): c is string => !!c))].sort((a, b) => countryName(a).localeCompare(countryName(b))),
    [directors],
  );
  const eras = useMemo(() => [...new Set(directors.flatMap((d) => d.decades))].sort(), [directors]);
  const active = (["country", "era", "min"] as const).filter((k) => state[k]);
  const label = (k: "country" | "era" | "min", v: string) => (k === "country" ? countryName(v) : k === "era" ? `Active in the ${v}` : `${v}+ films`);
  const view: View = state.view === "map" ? "map" : "cards";

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
        <div className="segmented" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={view === "cards"} onClick={() => set("view", "")} title="Cards">
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>
            <span className="visually-hidden">Cards</span>
          </button>
          <button type="button" role="radio" aria-checked={view === "map"} onClick={() => set("view", "map")} title="World map">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="stroke"><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3c2.2 2 3.2 4.4 3.2 7s-1 5-3.2 7c-2.2-2-3.2-4.4-3.2-7s1-5 3.2-7z" /></svg>
            <span className="visually-hidden">World map</span>
          </button>
        </div>
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
            <li><button type="button" className="link-button" onClick={() => commit({ q: state.q, sort: state.sort, view: state.view })}>Clear all</button></li>
          </ul>
        )}
      </div>

      {view === "map" && (
        <section className="world" aria-label="Where the directors come from">
          <div className="world-map" ref={mapBox} onMouseLeave={() => setHover(null)}>
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="img" aria-label="World map of directors by country">
              {map.map((c, i) => {
                const n = c.code ? byCountry.get(c.code) ?? 0 : 0;
                const selected = !!c.code && state.country === c.code;
                const shade = n ? 28 + Math.round((n / maxCount) * 62) : 0;
                return (
                  <path
                    key={`${c.code ?? "x"}-${i}`}
                    d={c.d}
                    className={`land${n ? " has" : ""}${selected ? " selected" : ""}`}
                    style={n && !selected ? { fill: `color-mix(in srgb, var(--ink) ${shade}%, var(--raised))` } : undefined}
                    tabIndex={n ? 0 : -1}
                    role={n ? "button" : undefined}
                    aria-label={n ? `${countryName(c.code!)}: ${n} ${n === 1 ? "director" : "directors"}` : undefined}
                    onMouseMove={(e) => {
                      const box = mapBox.current?.getBoundingClientRect();
                      if (box && c.name) setHover({ name: c.code ? countryName(c.code) : c.name, count: n, x: e.clientX - box.left, y: e.clientY - box.top });
                    }}
                    onClick={() => n && c.code && set("country", selected ? "" : c.code)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && n && c.code) {
                        e.preventDefault();
                        set("country", selected ? "" : c.code);
                      }
                    }}
                  />
                );
              })}
            </svg>
            {hover && (
              <div className="map-tip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
                <strong>{hover.name}</strong>
                <span>{hover.count ? `${hover.count} ${hover.count === 1 ? "director" : "directors"}` : "None yet"}</span>
              </div>
            )}
          </div>
          <div className="map-legend">
            <span className="label">{state.country ? `Showing ${countryName(state.country)}. Tap it again to see everyone.` : "Tap a country to see its directors."}</span>
            {offMap.length > 0 && (
              <span className="map-extra">
                <span className="label">Too small for the map:</span>
                {offMap.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={state.country === c} onClick={() => set("country", state.country === c ? "" : c)}>
                    {countryName(c)} <span className="count">{byCountry.get(c)}</span>
                  </button>
                ))}
              </span>
            )}
          </div>
        </section>
      )}

      {results.length ? (
        <ul className="director-grid">
          {results.map((d) => <DirectorCard key={d.id} director={d} />)}
        </ul>
      ) : (
        <div className="empty-state">
          <p>No directors match.</p>
          <button type="button" className="button ghost small" onClick={() => commit({ view: state.view })}>Clear search and filters</button>
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
          <section className="filter-group" aria-labelledby="dg-era">
            <h3 id="dg-era">Active in</h3>
            <ul className="chip-list">
              {eras.map((e) => {
                const n = directors.filter((d) => d.decades.includes(e)).length;
                return <li key={e}><button type="button" className="chip" aria-pressed={state.era === e} onClick={() => set("era", state.era === e ? "" : e)}>{e} <span className="count">{n}</span></button></li>;
              })}
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
          <button type="button" className="button ghost" onClick={() => commit({ q: state.q, view: state.view })} disabled={!active.length && !state.sort}>Reset</button>
          <button type="button" className="button" onClick={() => modal.current?.close()}>
            Show {results.length} {results.length === 1 ? "director" : "directors"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
