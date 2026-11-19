"use client";
import Link from 'next/link';
import FilterSelect from './FilterSelect';
import type {ReactNode} from 'react';
import { Suspense, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from './Icon';
import { FEEDS, type Feed } from './CollectionsToolbar';
import { openSignIn } from './SignInSheet';
import { getBrowserClient } from '@/lib/supabase/client';
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
let documentVisitId: string | undefined;
function Browser({ entries, mode, afterSearch }: {
    entries: SearchEntry[];
    mode: SearchMode;
    afterSearch?: ReactNode;
}) {
    const params = useSearchParams().toString();
    const [state, setState] = useState<SearchState>(() => cleanState(new URLSearchParams(params), mode));
    const [shown, setShown] = useState(PAGE);
    const [feed, setFeed] = useState<Feed>(() => { const f = new URLSearchParams(params).get('feed'); return f === 'featured' || f === 'following' ? f : 'all'; });
    const [followed, setFollowed] = useState<Set<string> | null>(null);
    const [shuffleSeed, setShuffleSeed] = useState(0);
    const [visitReady, setVisitReady] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const modal = useRef<HTMLDialogElement>(null);
    const inputId = useId();
    const historyKey = 'pheelm:catalog-search:' + mode + ':v1';
    useEffect(() => { setState(cleanState(new URLSearchParams(params), mode)); setShown(PAGE); }, [params, mode]);
    // Films and Directors no longer have a search box: an old link with words in it opens Search.
    const router = useRouter();
    useEffect(() => { const q = new URLSearchParams(params).get('q')?.trim(); if (q) router.replace('/search?' + new URLSearchParams({ category: mode, q }).toString()); }, [params, mode, router]);
    useEffect(() => {
        if (mode !== 'films') { setVisitReady(true); return; }
        documentVisitId ??= crypto.randomUUID();
        const saved = window.history.state?.pheelmFilmVisit;
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const restore = saved && (saved.document === documentVisitId || navigation?.type === 'back_forward') && Number.isInteger(saved.seed);
        const seed = restore ? saved.seed : crypto.getRandomValues(new Uint32Array(1))[0];
        setShuffleSeed(seed);
        if (restore && saved.query === window.location.search) {
            setShown(Math.max(PAGE, Math.min(entries.length, Number(saved.shown) || PAGE)));
            const frame = requestAnimationFrame(() => window.scrollTo(0, Number(saved.scroll) || 0));
            setVisitReady(true);
            return () => cancelAnimationFrame(frame);
        }
        setVisitReady(true);
    }, [mode, entries.length]);
    const saveVisit = () => {
        if (mode !== 'films' || !visitReady || window.location.pathname !== '/films') return;
        window.history.replaceState({ ...window.history.state, pheelmFilmVisit: {
            document: documentVisitId, seed: shuffleSeed, shown, scroll: window.scrollY, query: window.location.search,
        } }, '', window.location.href);
    };
    useEffect(() => { saveVisit(); }, [shuffleSeed, shown, visitReady]);
    useEffect(() => {
        window.addEventListener('pagehide', saveVisit);
        return () => window.removeEventListener('pagehide', saveVisit);
    }, [shuffleSeed, shown, visitReady, mode]);
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
    const rows = useMemo(() => searchEntries(index, deferred, mode, shuffleSeed), [index, deferred, mode, shuffleSeed]);
    const results = rows.map(r => r.entry).filter(e => mode !== 'directors' || feed === 'all' || (feed === 'featured' ? e.wins > 0 : !!followed?.has(e.id)));
    const filters = mode === 'films' ? FILM_FILTERS : DIRECTOR_FILTERS;
    const active = filters.filter(k => state[k]);
    const proposal = useMemo(() => state.q && !index.some(i => relevance(i, state.q!) >= 900) ? interpretQuery(state.q, mode, facets) : null, [state.q, index, mode, facets]);
    const commit = (s: SearchState) => { const next = cleanState(new URLSearchParams(stateQuery(s)), mode); setState(next); setShown(PAGE); const q = stateQuery(next) + (mode === 'directors' && feed !== 'all' ? (stateQuery(next) ? '&' : '') + 'feed=' + feed : ''); window.history.replaceState(window.history.state, '', window.location.pathname + (q ? '?' + q : '')); };
    useEffect(() => { if (mode === 'directors' && feed === 'following' && !followed) void chooseFeed('following', true); }, []);
    const chooseFeed = async (next: Feed, fromLink = false) => {
        if (next === 'following') {
            const db = getBrowserClient();
            const { data } = db ? await db.auth.getSession() : { data: { session: null } };
            const id = data.session?.user.id;
            if (!db || !id) { if (fromLink) setFeed('all'); else openSignIn('signup'); return; }
            const { data: rows } = await db.from('follows').select('person_id').eq('user_id', id);
            setFollowed(new Set((rows ?? []).map((r: { person_id: string }) => r.person_id)));
        }
        setFeed(next); setShown(PAGE);
        const q = stateQuery(state) + (next !== 'all' ? (stateQuery(state) ? '&' : '') + 'feed=' + next : '');
        window.history.replaceState(window.history.state, '', window.location.pathname + (q ? '?' + q : ''));
    };
    const set = (key: SearchKey, value: string) => commit({ ...state, [key]: value || undefined });
    const remember = (s: SearchState) => { if (!s.q && !filters.some(k => s[k]))
        return; const label = [s.q, ...filters.filter(k => s[k]).map(k => filterLabel(k, s[k]!))].filter(Boolean).join(' · ').slice(0, 200); const next = [{ label, state: s }, ...history.filter(h => stateQuery(h.state) !== stateQuery(s))].slice(0, 8); setHistory(next); try {
        localStorage.setItem(historyKey, JSON.stringify(next));
    }
    catch { } };
    const submit = () => { const next = proposal ? { ...state, q: undefined, ...proposal } : state; commit(next); remember(next); };
    const clearFilters = () => commit({ q: state.q, sort: state.sort });
    // With text in the search box and no sort chosen, the closest matches come first.
    const sortDefault = mode === 'films' ? 'shuffle' : 'films';
    const correction = useMemo(() => state.q ? (rows.length > 0 && rows[0].score === 450 ? rows[0].entry.title : rows.length === 0 && !index.some(i => relevance(i, state.q!) > 0) ? spellingCorrection(index, state.q) : null) : null, [state.q, rows, index]);
    const matchingIndex = useMemo(() => filtersOpen ? index.filter(i => relevance(i, state.q ?? '') > 0) : [], [index, state.q, filtersOpen]);
    const relaxed = state.q && active.length ? searchEntries(index, { q: state.q, sort: state.sort }, mode).length : 0;
    const options = (key: SearchKey): [
        string,
        string
    ][] => {
        if (key === 'award')
            return [['won', 'Award winners'], ['nominated', 'Award nominees']];
        if (key === 'min')
            return [['2', '2 or more'], ['3', '3 or more'], ['5', '5 or more'], ['10', '10 or more']];
        if (key in facets)
            return facets[key as keyof typeof facets].map(v => [v, key === 'country' || key === 'region' ? countryName(v) : key === 'type' ? TYPE_LABELS[v] ?? v : v]);
        return [];
    };
    const titles: Partial<Record<SearchKey, string>> = { min: 'Films in the directory', country: 'Country', decade: 'Decade', language: 'Language', genre: 'Genre', type: 'Type', provider: 'Where to watch' };
    const countFor = (key: SearchKey, value: string) => matchingIndex.filter(i => matchesFilters(i.entry, { ...state, [key]: value }, mode)).length;
    const boundsInvalid = !!((state.minRuntime && state.maxRuntime && +state.minRuntime > +state.maxRuntime) || (state.from && state.to && +state.from > +state.to));
    return <div className="browser catalog-browser" data-shuffle-ready={visitReady} aria-busy={state !== deferred} onClickCapture={e => { if ((e.target as Element).closest(".film-grid a, .director-grid a"))
        { saveVisit(); remember(state); } }}>
  <div className="toolbar catalog-toolbar">
   {mode === 'films'
    ? <div className="catalog-pills" role="group" aria-label="Sort and filter films">
      <label className="chip catalog-pill"><span>{SORTS[mode].find(([v]) => v === (state.sort ?? sortDefault))?.[1] ?? 'Sort'}</span><Icon name="arrowDown"/><select aria-label="Sort by" value={state.sort ?? sortDefault} onChange={e => set('sort', e.target.value)}>{SORTS[mode].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      {filters.map(k => <label key={k} className={"chip catalog-pill" + (state[k] ? " is-set" : "")}><span>{state[k] ? filterLabel(k, state[k]!) : titles[k] ?? k}</span><Icon name="arrowDown"/><select aria-label={titles[k] ?? k} value={state[k] ?? ''} onChange={e => set(k, e.target.value)}><option value="">Any {(titles[k] ?? k).toLowerCase()}</option>{state[k] && !options(k).some(([v]) => v === state[k]) && <option value={state[k]}>{filterLabel(k, state[k]!)}</option>}{options(k).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>)}
     </div>
    : <>
      <div className="feed-tabs" role="group" aria-label="Directors to show">
       {FEEDS.map(o => <button key={o.value} type="button" className={"chip" + (o.value === 'all' ? " feed-all" : "")} aria-pressed={feed === o.value} onClick={() => chooseFeed(o.value)}>{o.label}</button>)}
      </div>
      <button type="button" className={"button ghost filter-button" + (active.length || state.sort ? " has-count" : "")} aria-label="Filters" aria-haspopup="dialog" aria-controls={inputId+'-dialog'} aria-expanded={filtersOpen} onClick={() => { setFiltersOpen(true); modal.current?.showModal(); }}><Icon name="filter"/><span className="filter-label">Filters</span>{active.length > 0 && <span className="badge" aria-label={active.length + " active filters"}>{active.length}</span>}</button>
    </>}
  </div>
  {afterSearch}
  {mode === 'directors' && active.length > 0 && <ul className="chip-list catalog-active-filters" aria-label="Active filters">{active.map(k => <li key={k}><button type="button" className="chip" aria-label={'Remove ' + filterLabel(k, state[k]!)} onClick={() => set(k, '')}>{filterLabel(k, state[k]!)}<Icon name="close" className="x"/></button></li>)}</ul>}
  {(!!state.q?.trim() || active.length > 0) && <div className="result-bar catalog-results-summary" aria-live="polite">
   {active.length > 0 && <button type="button" className="link-button" onClick={clearFilters}>Clear</button>}
   <span className="result-count">{results.length} {results.length === 1 ? 'result' : 'results'}</span>
  </div>}
  {proposal && <div className="catalog-interpretation"><span>Search with filters: {Object.entries(proposal).filter(([k, v]) => k !== 'q' && v).map(([k, v]) => filterLabel(k as SearchKey, v!)).join(' · ')}</span><button type="button" className="button ghost" onClick={submit}>Apply filters</button></div>}
  {correction && <p className="catalog-correction">{rows.length > 0 ? 'Showing close matches. ' : ''}Did you mean <button type="button" className="link-button" onClick={() => set('q', correction)}>{correction}</button>?</p>}
  {boundsInvalid && <p className="notice error" role="alert">The minimum must be no greater than the maximum.</p>}
  {results.length ? <>
   {mode === 'films' ? <FilmGrid films={results.slice(0, shown).flatMap(e => e.film ? [e.film] : [])} priority={6}/> : <ul className="director-grid">{results.slice(0, shown).map(e => e.director && <DirectorCard key={e.id} director={e.director}/>)}</ul>}
   {shown < results.length && <div className="pagination-controls"><button type="button" className="button ghost more" onClick={() => setShown(n => n + PAGE)}>Load more</button><BackToTopButton /></div>}
  </> : <div className="empty-state"><Icon name="search" className="empty-icon"/><p>No {mode} match your search.</p><p className="muted">{relaxed ? 'Your search has ' + relaxed + ' matches without these filters.' : 'Check the spelling, try another name or remove a filter.'}</p>{active.length > 0 && <button type="button" className="button ghost" onClick={clearFilters}>Search without filters</button>}<button type="button" className="button ghost" onClick={() => commit({})}>Clear search and filters</button>{mode === 'films' && <Link href="/submit">Suggest a missing film</Link>}</div>}
  {mode === 'directors' && <dialog ref={modal} id={inputId+'-dialog'} className="modal catalog-filter-dialog" onClose={() => setFiltersOpen(false)} aria-labelledby={inputId + '-title'} onClick={e => { if (e.target === modal.current)
        modal.current?.close(); }}>
   <div className="modal-head"><span className="sheet-handle" aria-hidden="true"/><h2 id={inputId + '-title'}>Filters</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={() => modal.current?.close()}><Icon name="close"/></button></div>
   <div className="modal-body">
    {mode === 'directors' && <FilterSelect label="Sort by" value={state.sort ?? sortDefault} onChange={e => set('sort', e.target.value)}>{SORTS[mode].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</FilterSelect>}
    {filters.map(k => ['year', 'from', 'to', 'minRuntime', 'maxRuntime'].includes(k) ? <label key={k} className="field filter-field">{titles[k]}<input type="number" inputMode="numeric" min={k === 'minRuntime' || k === 'maxRuntime' ? 1 : 1890} max={k === 'minRuntime' || k === 'maxRuntime' ? 9999 : 2199} key={k + ':' + (state[k] ?? '')} defaultValue={state[k] ?? ''} onBlur={e => set(k, e.target.value)} onKeyDown={e => { if (e.key === 'Enter')
        e.currentTarget.blur(); }} placeholder="Any"/></label> : <FilterSelect key={k} label={titles[k]??k} value={state[k] ?? ''} onChange={e => set(k, e.target.value)}><option value="">Any</option>{state[k] && !options(k).some(([v]) => v === state[k]) && <option value={state[k]}>{filterLabel(k, state[k]!)}</option>}{options(k).map(([v, l]) => <option key={v} value={v}>{l}{active.length > 0 ? ` (${countFor(k, v)})` : ''}</option>)}</FilterSelect>)}
   </div><div className="modal-foot"><button type="button" className="button ghost" disabled={!active.length && !state.sort} onClick={() => commit({ q: state.q })}>Reset</button><button type="button" className="button" onClick={() => { remember(state); modal.current?.close(); }}>Show {active.length > 0 || state.q?.trim() ? `${results.length} ` : ''}{mode}</button></div>
  </dialog>}
 </div>;
}
export default function CatalogSearch(props: {
    entries: SearchEntry[];
    fallback?:ReactNode;
    mode: SearchMode;
    afterSearch?: ReactNode;
}) {
    return <Suspense fallback={props.fallback??<p className="muted" role="status">Loading search…</p>}><Browser {...props}/></Suspense>;
}


