"use client";
import Link from 'next/link';
import { Suspense, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import DirectorCard from './DirectorCard';
import { FilmGrid } from './FilmCard';
import { BackToTopButton } from './BackToTop';
import { countryName } from '@/lib/format';
import { plain } from '@/lib/fuzzy';
import { buildFacets, cleanState, DIRECTOR_FILTERS, FILM_FILTERS, filterLabel, indexEntries, interpretQuery, matchesFilters, relevance, searchEntries, spellingCorrection, SORTS, stateQuery, TYPE_LABELS, type SearchEntry, type SearchKey, type SearchMode, type SearchState } from '@/lib/catalog-search';
type HistoryItem = {
    label: string;
    state: SearchState;
};
const PAGE = 24;
function SearchField({ mode, value, onChange, results, history, onClearHistory, onHistory, onSubmit, onVisit, proposal }: {
    mode: SearchMode;
    value: string;
    onChange: (q: string) => void;
    results: SearchEntry[];
    history: HistoryItem[];
    onClearHistory: () => void;
    onHistory: (s: SearchState) => void;
    onSubmit: () => void;
    onVisit: () => void;
    proposal: SearchState | null;
}) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const id = useId();
    const router = useRouter();
    const options = value.trim() ? results.slice(0, 6) : [];
    const recent = value.trim() ? [] : history;
    const count = options.length + recent.length + (proposal ? 1 : 0);
    const choose = (n: number) => { if (n < 0) {
        onSubmit();
        setOpen(false);
        return;
    } if (proposal && n === 0) {
        onSubmit();
        setOpen(false);
        return;
    } const at = n - (proposal ? 1 : 0); if (value.trim()) {
        const item = options[at];
        if (item) {
            onVisit();
            router.push('/' + (mode === 'films' ? 'films' : 'directors') + '/' + item.slug);
        }
    }
    else if (recent[at]) {
        onHistory(recent[at].state);
        setOpen(false);
    } };
    useEffect(() => setActive(-1), [value]);
    useEffect(() => { if (open && active >= 0)
        document.getElementById(id + '-option-' + active)?.scrollIntoView({ block: 'nearest' }); }, [active, open, id]);
    return <div className="catalog-search-control" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null))
        setOpen(false); }}>
  <form className="search-bar" role="search" onSubmit={e => { e.preventDefault(); choose(open ? active : -1); }}>
   <Icon name="search"/><label htmlFor={id} className="visually-hidden">Search {mode}</label>
   <input id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={open && count > 0} aria-controls={id + '-suggestions'} aria-activedescendant={open && active >= 0 ? id + '-option-' + active : undefined} autoComplete="off" placeholder={'Search ' + mode} value={value} maxLength={200} onFocus={() => setOpen(true)} onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }} onKeyDown={e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setOpen(true);
        setActive(n => count ? (n < 0 ? (e.key === 'ArrowDown' ? 0 : count - 1) : (n + (e.key === 'ArrowDown' ? 1 : -1) + count) % count) : -1);
    }
    else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
    } }}/>
  </form>
  {open && count > 0 && <div className="catalog-suggestions">
   {!value.trim() && <div className="catalog-suggestion-head"><span>Recent searches on this device</span><button type="button" className="link-button" onClick={onClearHistory}>Clear history</button></div>}
   <ul id={id + '-suggestions'} role="listbox" aria-label={value.trim() ? 'Search suggestions' : 'Recent searches'}>
    {proposal && <li id={id + '-option-0'} role="option" aria-selected={active === 0}><button type="button" className="catalog-suggestion" onClick={() => { onSubmit(); setOpen(false); }}><Icon name="filter"/><span>Use filters<span className="muted">{Object.entries(proposal).filter(([k, v]) => k !== 'q' && v).map(([k, v]) => filterLabel(k as SearchKey, v!)).join(' · ')}</span></span></button></li>}
    {options.map((item, i) => {
                const n = i + (proposal ? 1 : 0);
                return <li key={item.id} id={id + '-option-' + n} role="option" aria-selected={active === n}><Link className="catalog-suggestion" href={'/' + (mode === 'films' ? 'films' : 'directors') + '/' + item.slug} onClick={onVisit}>
      {item.image ? <img src={item.image} alt="" width={36} height={54}/> : <span className="catalog-suggestion-placeholder"><Icon name={mode === 'films' ? 'film' : 'user'}/></span>}<span>{item.title}<span className="muted">{item.subtitle}</span></span>
     </Link></li>;
            })}
    {recent.map((item, i) => <li key={stateQuery(item.state)} id={id + '-option-' + i} role="option" aria-selected={active === i}><button type="button" className="catalog-suggestion" onClick={() => { onHistory(item.state); setOpen(false); }}><Icon name="search"/><span>{item.label}</span></button></li>)}
   </ul>
  </div>}
 </div>;
}
function Browser({ entries, mode }: {
    entries: SearchEntry[];
    mode: SearchMode;
}) {
    const params = useSearchParams().toString();
    const [state, setState] = useState<SearchState>(() => cleanState(new URLSearchParams(params), mode));
    const [shown, setShown] = useState(PAGE);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const modal = useRef<HTMLDialogElement>(null);
    const inputId = useId();
    const historyKey = 'pheelm:catalog-search:' + mode + ':v1';
    useEffect(() => { setState(cleanState(new URLSearchParams(params), mode)); setShown(PAGE); }, [params, mode]);
    useEffect(() => { try {
        const saved: unknown = JSON.parse(localStorage.getItem(historyKey) ?? '[]');
        if (Array.isArray(saved))
            setHistory(saved.slice(0, 8).filter((v): v is HistoryItem => !!v && typeof v.label === 'string' && !!v.state && typeof v.state === 'object').map(v => ({ label: v.label.slice(0, 200), state: cleanState(new URLSearchParams(stateQuery(v.state)), mode) })));
    }
    catch {
        setHistory([]);
    } }, [historyKey, mode]);
    const facets = useMemo(() => buildFacets(entries), [entries]);
    const index = useMemo(() => indexEntries(entries), [entries]);
    const deferred = useDeferredValue(state);
    const rows = useMemo(() => searchEntries(index, deferred, mode), [index, deferred, mode]);
    const results = rows.map(r => r.entry);
    const filters = mode === 'films' ? FILM_FILTERS : DIRECTOR_FILTERS;
    const active = filters.filter(k => state[k]);
    const proposal = useMemo(() => state.q && !index.some(i => relevance(i, state.q!) >= 900) ? interpretQuery(state.q, mode, facets) : null, [state.q, index, mode, facets]);
    const commit = (s: SearchState) => { const next = cleanState(new URLSearchParams(stateQuery(s)), mode); setState(next); setShown(PAGE); const q = stateQuery(next); window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '')); };
    const set = (key: SearchKey, value: string) => commit({ ...state, [key]: value || undefined });
    const remember = (s: SearchState) => { if (!s.q && !filters.some(k => s[k]))
        return; const label = [s.q, ...filters.filter(k => s[k]).map(k => filterLabel(k, s[k]!))].filter(Boolean).join(' · ').slice(0, 200); const next = [{ label, state: s }, ...history.filter(h => stateQuery(h.state) !== stateQuery(s))].slice(0, 8); setHistory(next); try {
        localStorage.setItem(historyKey, JSON.stringify(next));
    }
    catch { } };
    const clearHistory = () => { setHistory([]); try {
        localStorage.removeItem(historyKey);
    }
    catch { } };
    const submit = () => { const next = proposal ? { ...state, q: undefined, ...proposal } : state; commit(next); remember(next); };
    const clearFilters = () => commit({ q: state.q, sort: state.sort });
    const sortDefault = state.q ? 'relevance' : mode === 'films' ? 'shuffle' : 'films';
    const correction = useMemo(() => state.q ? (rows.length > 0 && rows[0].score === 450 ? rows[0].entry.title : rows.length === 0 && !index.some(i => relevance(i, state.q!) > 0) ? spellingCorrection(index, state.q) : null) : null, [state.q, rows, index]);
    const matchingIndex = useMemo(() => filtersOpen ? index.filter(i => relevance(i, state.q ?? '') > 0) : [], [index, state.q, filtersOpen]);
    const relaxed = state.q && active.length ? searchEntries(index, { q: state.q, sort: state.sort }, mode).length : 0;
    const options = (key: SearchKey): [
        string,
        string
    ][] => {
        if (key === 'award')
            return [['won', 'Award winners'], ['nominated', 'Award nominees']];
        if (key === 'access')
            return [['stream', 'Streaming'], ['rent', 'Rent'], ['buy', 'Buy'], ['free', 'Free to watch']];
        if (key === 'min')
            return [['2', '2 or more'], ['3', '3 or more'], ['5', '5 or more'], ['10', '10 or more']];
        if (key in facets)
            return facets[key as keyof typeof facets].map(v => [v, key === 'country' || key === 'region' ? countryName(v) : key === 'type' ? TYPE_LABELS[v] ?? v : v]);
        return [];
    };
    const titles: Partial<Record<SearchKey, string>> = { country: 'Country', decade: 'Decade', year: 'Release year', language: 'Language', genre: 'Genre', type: 'Film type', minRuntime: 'Minimum runtime (minutes)', maxRuntime: 'Maximum runtime (minutes)', award: 'Awards', festival: 'Award or festival', provider: 'Where to watch', region: 'Viewing region', access: 'Viewing option', from: 'Films from year', to: 'Films through year', min: 'Films in the directory' };
    const countFor = (key: SearchKey, value: string) => matchingIndex.filter(i => matchesFilters(i.entry, { ...state, [key]: value }, mode)).length;
    const boundsInvalid = !!((state.minRuntime && state.maxRuntime && +state.minRuntime > +state.maxRuntime) || (state.from && state.to && +state.from > +state.to));
    return <div className="browser catalog-browser" aria-busy={state !== deferred} onClickCapture={e => { if ((e.target as Element).closest(".film-grid a, .director-grid a"))
        remember(state); }}>
  <div className="toolbar catalog-toolbar">
   <SearchField mode={mode} value={state.q ?? ''} onChange={q => set('q', q)} results={results} history={history} onClearHistory={clearHistory} onHistory={s => { commit(s); remember(s); }} onSubmit={submit} onVisit={() => remember(state)} proposal={proposal}/>
   <button type="button" className="button ghost filter-button" aria-haspopup="dialog" onClick={() => { setFiltersOpen(true); modal.current?.showModal(); }}><Icon name="filter"/><span className="filter-label">Filters</span>{active.length > 0 && <span className="badge">{active.length}</span>}</button>
  </div>
  <div className="result-bar" aria-live="polite">
   {(!!state.q?.trim() || active.length > 0) && <span className="result-count">{results.length} {results.length === 1 ? 'result' : 'results'}</span>}
   {active.length > 0 && <ul className="chip-list">{active.map(k => <li key={k}><button type="button" className="chip" aria-label={'Remove ' + filterLabel(k, state[k]!)} onClick={() => set(k, '')}>{filterLabel(k, state[k]!)}<Icon name="close" className="x"/></button></li>)}<li><button type="button" className="link-button" onClick={clearFilters}>Clear filters</button></li></ul>}
  </div>
  {proposal && <div className="catalog-interpretation"><span>Search with filters: {Object.entries(proposal).filter(([k, v]) => k !== 'q' && v).map(([k, v]) => filterLabel(k as SearchKey, v!)).join(' · ')}</span><button type="button" className="button ghost" onClick={submit}>Apply filters</button></div>}
  {correction && <p className="catalog-correction">{rows.length > 0 ? 'Showing close matches. ' : ''}Did you mean <button type="button" className="link-button" onClick={() => set('q', correction)}>{correction}</button>?</p>}
  {boundsInvalid && <p className="notice error" role="alert">The minimum must be no greater than the maximum.</p>}
  {results.length ? <>
   {mode === 'films' ? <FilmGrid films={results.slice(0, shown).flatMap(e => e.film ? [e.film] : [])} priority={6}/> : <ul className="director-grid">{results.slice(0, shown).map(e => e.director && <DirectorCard key={e.id} director={e.director}/>)}</ul>}
   {shown < results.length && <div className="pagination-controls"><button type="button" className="button ghost more" onClick={() => setShown(n => n + PAGE)}>Load more</button><BackToTopButton /></div>}
  </> : <div className="empty-state"><Icon name="search" className="empty-icon"/><p>No {mode} match your search.</p><p className="muted">{relaxed ? 'Your search has ' + relaxed + ' matches without these filters.' : 'Check the spelling, try another name or remove a filter.'}</p>{active.length > 0 && <button type="button" className="button ghost" onClick={clearFilters}>Search without filters</button>}<button type="button" className="button ghost" onClick={() => commit({})}>Clear search and filters</button>{mode === 'films' && <Link href="/submit">Suggest a missing film</Link>}</div>}
  <dialog ref={modal} className="modal catalog-filter-dialog" onClose={() => setFiltersOpen(false)} aria-labelledby={inputId + '-title'} onClick={e => { if (e.target === modal.current)
        modal.current?.close(); }}>
   <div className="modal-head"><span className="sheet-handle" aria-hidden="true"/><h2 id={inputId + '-title'}>Filters</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={() => modal.current?.close()}><Icon name="close"/></button></div>
   <div className="modal-body"><label className="field filter-field">Sort by<select value={state.sort ?? sortDefault} onChange={e => set('sort', e.target.value)}>{SORTS[mode].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    {filters.map(k => ['year', 'from', 'to', 'minRuntime', 'maxRuntime'].includes(k) ? <label key={k} className="field filter-field">{titles[k]}<input type="number" inputMode="numeric" min={k === 'minRuntime' || k === 'maxRuntime' ? 1 : 1890} max={k === 'minRuntime' || k === 'maxRuntime' ? 9999 : 2199} key={k + ':' + (state[k] ?? '')} defaultValue={state[k] ?? ''} onBlur={e => set(k, e.target.value)} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }} placeholder="Any"/></label> : <label key={k} className="field filter-field">{titles[k]}<select value={state[k] ?? ''} onChange={e => set(k, e.target.value)}><option value="">Any</option>{state[k] && !options(k).some(([v]) => v === state[k]) && <option value={state[k]}>{filterLabel(k, state[k]!)}</option>}{options(k).map(([v, l]) => <option key={v} value={v}>{l} ({countFor(k, v)})</option>)}</select></label>)}
    {mode === 'films' && <p className="muted">Viewing availability varies by region and reflects the links currently in our directory.</p>}{mode === 'directors' && <p className="muted">Year and film-type filters refer to films listed in this directory.</p>}
   </div><div className="modal-foot"><button type="button" className="button ghost" disabled={!active.length && !state.sort} onClick={() => commit({ q: state.q })}>Reset</button><button type="button" className="button" onClick={() => { remember(state); modal.current?.close(); }}>Show {results.length} {mode}</button></div>
  </dialog>
 </div>;
}
export default function CatalogSearch(props: {
    entries: SearchEntry[];
    mode: SearchMode;
}) {
    return <Suspense fallback={<p className="muted" role="status">Loading search…</p>}><Browser {...props}/></Suspense>;
}

