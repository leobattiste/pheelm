"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import FilmCard, { FilmGrid } from './FilmCard';
import Row from './Row';
import FollowButton from './FollowButton';
import { recentlyAdded } from '@/lib/search-discovery';
import DirectorCard from './DirectorCard';
import CommunityTile from './CommunityTile';
import UserAvatar from './UserAvatar';
import MemberFollowButton from './MemberFollowButton';
import FilterSelect from './FilterSelect';
import { getBrowserClient } from '@/lib/supabase/client';
import { countryName } from '@/lib/format';
import { QUICK_FILTERS, SERVICES_KEY, THEMES, matchReason, naturalFilters, quickActive, recommendations, toggleQuick } from '@/lib/search-extras';
import { VIEWS, defaultView, type SearchView, CATEGORY_LABELS, CATEGORIES, CATEGORY_FILTERS, UNIFIED_SORTS, activeUnifiedFilters, cleanUnifiedState, indexUnified, searchUnified, unifiedCorrection, unifiedFacets, unifiedFilterLabel, unifiedQuery, type SearchCategory, type UnifiedFilter, type UnifiedResult, type UnifiedSearchData, type UnifiedSearchState } from '@/lib/unified-search';

const PAGE = 36;
type Recent = {label:string;state:UnifiedSearchState};
const FILTER_LABELS:Record<UnifiedFilter,string>={genre:'Genre',country:'Country',language:'Language',from:'From year',to:'Through year',minRuntime:'Minimum runtime',maxRuntime:'Maximum runtime',type:'Film type',award:'Awards',festival:'Award or festival',provider:'Provider',region:'Region',availability:'Availability',min:'Minimum films',max:'Maximum films',updated:'Recently updated',services:'On my services',following:'Members you follow',followsYou:'Members following you'};
const NUMERIC = new Set(['from','to','minRuntime','maxRuntime','min','max']);

export default function UnifiedSearch({initialData}:{initialData:UnifiedSearchData}) {
 const router=useRouter();
 const params=useSearchParams().toString();
 const [data,setData]=useState(initialData);
 const [refreshError,setRefreshError]=useState(false);
 const retry=()=>{setRefreshError(false);router.refresh();};
 const [state,setState]=useState(()=>cleanUnifiedState(new URLSearchParams(params)));
 const [shown,setShown]=useState(PAGE);
 const [recent,setRecent]=useState<Recent[]>([]);
 const [suggestionsOpen,setSuggestionsOpen]=useState(false);
 const [active,setActive]=useState(-1);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const field=useRef<HTMLInputElement>(null);
 const fieldWrap=useRef<HTMLDivElement>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const id=useId();
 const historyKey='pheelm:search:v1:'+(data.viewerId??'visitor');
 // Every category is indexed once per data change, not once per keystroke.
 const indexes=useMemo(()=>Object.fromEntries(CATEGORIES.map(c=>[c,indexUnified(data,c)])) as Record<SearchCategory,ReturnType<typeof indexUnified>>,[data]);
 const dataView:SearchCategory=state.category==='all'?'films':state.category;
 const index=indexes[dataView];
 const facets=useMemo(()=>unifiedFacets(index),[index]);
 const filmFacets=useMemo(()=>unifiedFacets(indexes.films),[indexes]);
 const [services,setServices]=useState<string[]>([]);
 useEffect(()=>{try{const v:unknown=JSON.parse(localStorage.getItem(SERVICES_KEY)??'[]');setServices(Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,40):[]);}catch{}},[]);
 const saveServices=(next:string[])=>{setServices(next);try{localStorage.setItem(SERVICES_KEY,JSON.stringify(next));}catch{}};
 const deferred=useDeferredValue(state);
 const results=useMemo(()=>deferred.category==='all'?[]:searchUnified(indexes[deferred.category],deferred,Date.now(),services),[indexes,deferred,services]);
 // The words alone, in every category: for the All view, tab counts and suggestions.
 const perCategory=useMemo(()=>Object.fromEntries(CATEGORIES.map(c=>[c,deferred.q.trim()?searchUnified(indexes[c],{category:c,q:deferred.q.trim()}):[]])) as Record<SearchCategory,UnifiedResult[]>,[indexes,deferred.q]);
 const activeFilters=activeUnifiedFilters(state);
 const searching=!!state.q.trim();
 const activeSearch=searching||activeFilters.length>0;
 const total=CATEGORIES.reduce((n,c)=>n+perCategory[c].length,0);
 const categoryCounts:Record<SearchView,number>={all:total,...Object.fromEntries(CATEGORIES.map(c=>[c,perCategory[c].length]))} as Record<SearchView,number>;
 const empty=state.category==='all'?total===0:results.length===0;
 const recs=useMemo(()=>data.signedIn?recommendations(data):null,[data]);
 const themes=useMemo(()=>THEMES.map(t=>({...t,count:searchUnified(indexes.films,{category:'films',q:'',...t.filters}).length})).filter(t=>t.count>=3),[indexes]);
 const natural=useMemo(()=>(state.category==='all'||state.category==='films')&&deferred.q.trim()?naturalFilters(deferred.q,data.films as never):null,[deferred.q,state.category,data.films]);
 const recentFilms=useMemo(()=>recentlyAdded(data.films),[data.films]);
 const popularFilms=(data.popularFilmIds??[]).flatMap(id=>data.films.find(f=>f.id===id)??[]);
 const suggestedDirectors=data.directors.filter(d=>d.count>=3&&!(data.followedDirectorIds??[]).includes(d.id)).slice(0,12);
 const community=data.watchlists.filter(w=>w.is_public&&w.filmIds.length>0).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,12);
 const genres=[...new Set(data.films.flatMap(f=>f.genres))].sort((a,b)=>a.localeCompare(b));
 // Suggestions: a few from each category, in one list the arrow keys move through.
 const SUGGEST:Record<SearchCategory,number>={films:4,directors:2,watchlists:2,members:2};
 const options=state.q.trim()?CATEGORIES.flatMap(c=>perCategory[c].slice(0,SUGGEST[c]).map(r=>({...r,category:c}))):[];
 const recents=state.q.trim()?[]:recent;
 const suggestionCount=options.length+recents.length;
 const mounted=useRef(false);
 const query=unifiedQuery(state);
 const latest=useRef({query,shown});latest.current={query,shown};
 const urlTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const saveVisit=()=>{
  if(window.location.pathname!=='/search')return;
  if(urlTimer.current){clearTimeout(urlTimer.current);urlTimer.current=null;}
  window.history.replaceState({...window.history.state,pheelmSearchVisit:{query:latest.current.query,shown:latest.current.shown,scroll:window.scrollY}},'','/search'+(latest.current.query?'?'+latest.current.query:''));
 };
 useEffect(()=>{setData(initialData);},[initialData]);
 useEffect(()=>{try{if(sessionStorage.getItem('pheelm:search-focus')==='1'){sessionStorage.removeItem('pheelm:search-focus');field.current?.focus();}}catch{}},[]);
 useEffect(()=>{
  const db=getBrowserClient();if(!db)return;
  let disposed=false;
  let generation=0;
  let pending:AbortController|null=null;
  const {data:{subscription}}=db.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='INITIAL_SESSION'&&(session?.user.id??null)!==initialData.viewerId) {
    const viewerId=session?.user.id??null;
    setRecent([]);setSuggestionsOpen(false);setActive(-1);
    const request=++generation;
    pending?.abort();pending=new AbortController();
    // Remove request-private results before the next account's data can arrive.
    setData(current=>({...current,viewerId,signedIn:!!viewerId,watchlists:current.watchlists.filter(list=>list.is_public),followedDirectorIds:[],members:current.members.map(member=>({...member,following:false,followsYou:false}))}));
    void fetch('/api/search',{cache:'no-store',signal:pending.signal}).then(r=>{if(!r.ok)throw Error('Search refresh failed');return r.json();}).then((next:UnifiedSearchData)=>{if(!disposed&&request===generation&&next.viewerId===viewerId)setData(next);}).catch(error=>{if(!disposed&&request===generation&&error.name!=='AbortError')setRefreshError(true);});
   }
  });
  return()=>{disposed=true;pending?.abort();subscription.unsubscribe();};
 },[router]);
 useEffect(()=>{
  const next=cleanUnifiedState(new URLSearchParams(params));
  if(mounted.current&&unifiedQuery(next)===latest.current.query)return;
  mounted.current=true;setState(next);setSuggestionsOpen(false);setActive(-1);
  const visit=window.history.state?.pheelmSearchVisit;
  const restore=visit?.query===unifiedQuery(next);
  setShown(restore?Math.max(PAGE,Math.min(10000,Number(visit.shown)||PAGE)):PAGE);
  if(restore){const frame=requestAnimationFrame(()=>window.scrollTo(0,Number(visit.scroll)||0));return()=>cancelAnimationFrame(frame);}
 },[params]);
 useEffect(()=>{
  try{const saved:unknown=JSON.parse(localStorage.getItem(historyKey)??'[]');setRecent(Array.isArray(saved)?saved.slice(0,8).flatMap(item=>{
   if(!item||typeof item.label!=='string'||!item.state||typeof item.state!=='object')return[];
   const clean=cleanUnifiedState(new URLSearchParams(unifiedQuery(item.state)));return clean.q.trim()?[{label:item.label.slice(0,200),state:clean}]:[];
  }):[]);}catch{setRecent([]);}
 },[historyKey]);
 useEffect(()=>{
  const dismiss=(event:PointerEvent)=>{if(!fieldWrap.current?.contains(event.target as Node))setSuggestionsOpen(false);};
  document.addEventListener('pointerdown',dismiss,true);
  let timer:ReturnType<typeof setTimeout>|null=null;
  const save=()=>{if(!timer)timer=setTimeout(()=>{timer=null;saveVisit();},1000);};
  window.addEventListener('scroll',save,{passive:true});window.addEventListener('pagehide',saveVisit);
  return()=>{document.removeEventListener('pointerdown',dismiss,true);window.removeEventListener('scroll',save);window.removeEventListener('pagehide',saveVisit);if(timer)clearTimeout(timer);if(urlTimer.current)clearTimeout(urlTimer.current);};
 },[]);
 useEffect(()=>{if(suggestionsOpen&&active>=0)document.getElementById(id+'-option-'+active)?.scrollIntoView({block:'nearest'});},[active,suggestionsOpen,id]);
 const commit=(next:UnifiedSearchState)=>{
  const clean=cleanUnifiedState(new URLSearchParams(unifiedQuery(next)));setState(clean);setShown(PAGE);setActive(-1);
  const q=unifiedQuery(clean);
  if(urlTimer.current)clearTimeout(urlTimer.current);
  const update=()=>{urlTimer.current=null;window.history.replaceState({...window.history.state,pheelmSearchVisit:undefined},'','/search'+(q?'?'+q:''));};
  if(clean.q!==state.q)urlTimer.current=setTimeout(update,600);else update();
 };
 const setFilter=(key:UnifiedFilter,value:string)=>commit({...state,[key]:value||undefined});
 const switchCategory=(category:SearchView)=>{commit({category,q:state.q});setSuggestionsOpen(false);};
 const clearFilters=()=>commit({category:state.category,q:state.q,sort:state.sort});
 const remember=()=>{
  if(!state.q.trim())return;
  const next=[{label:state.q.trim(),state},...recent.filter(r=>unifiedQuery(r.state)!==unifiedQuery(state))].slice(0,8);
  setRecent(next);try{localStorage.setItem(historyKey,JSON.stringify(next));}catch{}
 };
 const visit=(result:UnifiedResult)=>{remember();saveVisit();setSuggestionsOpen(false);router.push(result.href);};
 const submit=()=>{if(state.q!==state.q.trim()){const next={...state,q:state.q.trim()};latest.current.query=unifiedQuery(next);commit(next);}remember();saveVisit();setSuggestionsOpen(false);setActive(-1);field.current?.blur();};
 const choose=(at:number)=>{if(at<0){submit();return;}if(state.q.trim()&&options[at])visit(options[at]);else if(recents[at]){commit(recents[at].state);setSuggestionsOpen(false);}};
 const correction=useMemo(()=>state.q.trim()&&empty?unifiedCorrection(index,state.q):null,[index,state.q,empty]);
 // Searches that find nothing are counted (no account details) so admins can see what's missing.
 const logged=useRef(new Set<string>());
 useEffect(()=>{const q=deferred.q.trim().toLowerCase();if(q.length<3||total>0||logged.current.has(q))return;const t=setTimeout(()=>{logged.current.add(q);const db=getBrowserClient();void db?.rpc('log_search_miss',{q}).then(()=>{},()=>{});},2500);return()=>clearTimeout(t);},[deferred.q,total]);
 // More results load as you reach the end of the list.
 const sentinel=useRef<HTMLDivElement>(null);
 useEffect(()=>{const el=sentinel.current;if(!el||typeof IntersectionObserver==='undefined')return;const io=new IntersectionObserver(e=>{if(e[0]?.isIntersecting)setShown(n=>n+PAGE);},{rootMargin:'600px'});io.observe(el);return()=>io.disconnect();});
 const boundsInvalid=(state.from&&state.to&&+state.from>+state.to)||(state.minRuntime&&state.maxRuntime&&+state.minRuntime>+state.maxRuntime)||(state.min&&state.max&&+state.min>+state.max);
 const filterOptions=(key:UnifiedFilter):[string,string][]=>{
  if(key==='award')return[['won','Award winners'],['nominated','Award nominees']];
  if(key==='availability')return[['stream','Streaming'],['free','Free'],['rent','Rent'],['buy','Buy']];
  if(key==='updated')return[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days']];
  return key in facets?facets[key as keyof typeof facets].map(value=>[value,unifiedFilterLabel(key,value)]):[];
 };
 const extrasFor=(list:UnifiedResult[])=>Object.fromEntries(list.flatMap(r=>{const why=matchReason(r,deferred.q);return why?[[r.id,why]]:[];}));
 const reasonLine=(r:UnifiedResult)=>{const why=matchReason(r,deferred.q);return why?<p className="match-reason">{why}</p>:null;};
 const renderList=(category:SearchCategory,list:UnifiedResult[])=>{
  if(category==='films')return <FilmGrid films={list.flatMap(r=>r.entry?.film?[r.entry.film]:[])} priority={6} extras={extrasFor(list)}/>;
  if(category==='directors')return <ul className="director-grid" aria-label="Directors results">{list.map(r=>r.entry?.director?<DirectorCard key={r.id} director={r.entry.director} footer={reasonLine(r)}/>:null)}</ul>;
  if(category==='watchlists')return <ul className="collection-list" aria-label="Watchlists results">{list.map(r=>r.watchlist?<CommunityTile key={r.id} c={r.watchlist.tile} filmCount={r.count} badge={r.watchlist.is_public?undefined:'Private'}/>:null)}</ul>;
  return <ul className="unified-members" aria-label="Members results">{list.map(r=>r.member?<li key={r.id}><Link href={r.href} className="unified-member"><UserAvatar person={r.member} size={48}/><span><span className="unified-member-name">{r.title}</span><span className="muted">@{r.member.handle}{matchReason(r,deferred.q)?' • '+matchReason(r,deferred.q):''}</span></span></Link>{r.member.id!==data.viewerId&&<MemberFollowButton memberId={r.id} name={r.title} viewerId={data.viewerId} initialFollowing={r.member.following} onChange={following=>setData(current=>({...current,members:current.members.map(m=>m.id===r.id?{...m,following}:m)}))}/>}</li>:null)}</ul>;
 };
 const ALL_LIMIT:Record<SearchCategory,number>={films:8,directors:3,watchlists:3,members:4};
 const quick=QUICK_FILTERS.filter(f=>!(f.id==='free'||f.id==='stream')||filmFacets.provider.length>0);
 const filmCategory=state.category==='all'||state.category==='films';
 return <div className="unified-search" aria-busy={state!==deferred}>
  {refreshError&&<p className="notice" role="alert">Search could not be refreshed. <button type="button" className="link-button" onClick={retry}>Retry</button></p>}
  <div className="toolbar catalog-toolbar"><div className="catalog-search-control unified-search-field" ref={fieldWrap} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setSuggestionsOpen(false);}}>
   <form className="search-bar" role="search" onSubmit={e=>{e.preventDefault();choose(suggestionsOpen?active:-1);}}>
    <Icon name="search"/><label htmlFor={id+'-query'} className="visually-hidden">Search {state.category==='all'?'everything':state.category}</label>
    <input ref={field} id={id+'-query'} type="search" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen&&suggestionCount>0} aria-controls={suggestionsOpen&&suggestionCount>0?id+'-suggestions':undefined} aria-activedescendant={suggestionsOpen&&active>=0?id+'-option-'+active:undefined} placeholder="Search films, directors, watchlists, and members…" autoComplete="off" maxLength={200} value={state.q} onFocus={()=>setSuggestionsOpen(true)} onClick={()=>setSuggestionsOpen(true)} onChange={e=>{const q=e.target.value;commit({...state,q,category:!state.q.trim()&&q.trim()?'all':!q.trim()?'films':state.category});setSuggestionsOpen(true);}} onKeyDown={e=>{
     if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSuggestionsOpen(true);setActive(n=>suggestionCount?(n<0?(e.key==='ArrowDown'?0:suggestionCount-1):(n+(e.key==='ArrowDown'?1:-1)+suggestionCount)%suggestionCount):-1);}
     if(e.key==='Escape'){e.preventDefault();setSuggestionsOpen(false);setActive(-1);}
    }}/>
    {state.q&&<button className="catalog-clear-query" type="button" aria-label="Clear search" onClick={()=>{commit({category:'films',q:''});setSuggestionsOpen(false);field.current?.focus();}}><Icon name="close"/></button>}
   </form>
   {suggestionsOpen&&suggestionCount>0&&<div className="catalog-suggestions">
    {!state.q.trim()&&<div className="catalog-suggestion-head"><span>Recent searches</span><button className="link-button" type="button" onClick={()=>{setRecent([]);try{localStorage.removeItem(historyKey);}catch{}}}>Clear history</button></div>}
    <ul id={id+'-suggestions'} role="listbox" aria-label={state.q.trim()?'Search suggestions':'Recent searches'}>
     {options.map((result,i)=><li key={result.category+result.id} id={id+'-option-'+i} role="option" aria-selected={active===i}>
      {(i===0||options[i-1].category!==result.category)&&<span className="suggestion-group" aria-hidden="true">{CATEGORY_LABELS[result.category]}</span>}
      <Link href={result.href} className="catalog-suggestion" onClick={()=>{remember();saveVisit();setSuggestionsOpen(false);}}>{result.image?<img src={result.image} width={36} height={54} alt="" className={result.category==='members'||result.category==='directors'?'is-round':undefined}/>:<span className="catalog-suggestion-placeholder"><Icon name={result.category==='films'?'film':result.category==='watchlists'?'stack':'user'}/></span>}<span>{result.title}<span className="muted">{matchReason(result,state.q)??result.subtitle}</span></span></Link></li>)}
     {recents.map((item,i)=><li key={unifiedQuery(item.state)} id={id+'-option-'+i} role="option" aria-selected={active===i}><button className="catalog-suggestion" type="button" onClick={()=>choose(i)}><Icon name="search"/><span>{item.label}<span className="muted">{CATEGORY_LABELS[item.state.category]}</span></span></button></li>)}
    </ul>
   </div>}
  </div>
  {searching&&state.category!=='all'&&<button type="button" className={"button ghost filter-button"+(activeFilters.length?" has-count":"")} aria-haspopup="dialog" aria-controls={id+'-filters'} aria-expanded={filtersOpen} onClick={()=>{setSuggestionsOpen(false);setFiltersOpen(true);dialog.current?.showModal();}}><Icon name="filter"/><span className="filter-label">Filters</span>{activeFilters.length>0&&<span className="badge" aria-label={activeFilters.length+' active filters'}>{activeFilters.length}</span>}</button>}
  </div>
  {!activeSearch&&<div className="search-discovery">
   {recs&&recs.byFollowed.length>0&&<Row title="From directors you follow">{recs.byFollowed.map(e=>e.film?<FilmCard key={e.id} film={e.film}/>:null)}</Row>}
   {recs&&recs.fromPeople.length>0&&<Row title="Saved by people you follow">{recs.fromPeople.map(e=>e.film?<FilmCard key={e.id} film={e.film}/>:null)}</Row>}
   <Row title="Popular">{popularFilms.map(entry=>entry.film?<FilmCard key={entry.id} film={entry.film}/>:null)}{!popularFilms.length&&<li className="muted">Popular films are unavailable right now.</li>}</Row>
   <Row title="Recently Added">{recentFilms.map(entry=>entry.film?<FilmCard key={entry.id} film={entry.film}/>:null)}</Row>
   {themes.length>0&&<Row title="Explore by Theme" className="search-themes">{themes.map(t=><li key={t.id}><Link className="theme-tile" href={'/search?'+unifiedQuery({category:'films',q:'',...t.filters})} onClick={e=>{e.preventDefault();commit({category:'films',q:'',...t.filters});window.scrollTo(0,0);}}><span className="theme-title">{t.title}</span><span className="muted">{t.count} films</span></Link></li>)}</Row>}
   <Row title="Directors to Follow">{suggestedDirectors.map(entry=>entry.director?<DirectorCard key={entry.id} director={entry.director} footer={<FollowButton key={data.viewerId??"visitor"} personId={entry.id} name={entry.title} onChange={following=>setData(current=>current.viewerId!==data.viewerId?current:({...current,followedDirectorIds:following?[...new Set([...(current.followedDirectorIds??[]),entry.id])]:(current.followedDirectorIds??[]).filter(id=>id!==entry.id)}))}/>}/>:null)}{!suggestedDirectors.length&&<li className="muted">You’re following all eligible directors. Check back for new additions.</li>}</Row>
   <Row title="From the Community">{community.map(list=><CommunityTile key={list.id} c={list.tile} filmCount={list.filmIds.length}/>)}{!community.length&&<li className="muted">No public watchlists yet.</li>}</Row>
   <Row title="Explore by Genre" className="search-genres">{genres.map(genre=><li key={genre}><Link className="chip" href={"/films?"+new URLSearchParams({genre})}>{genre}</Link></li>)}</Row>
  </div>}
  {activeSearch&&<>
  <div className="unified-controls">
   <div role="tablist" aria-label="Search category" className="unified-tabs chip-row">{VIEWS.filter(v=>v!=='all'||searching).map((category,i,views)=><button key={category} type="button" role="tab" id={id+'-tab-'+category} aria-selected={state.category===category} aria-controls={id+'-results'} tabIndex={state.category===category?0:-1} className="chip" onClick={()=>switchCategory(category)} onKeyDown={e=>{let next=-1;if(e.key==='ArrowRight')next=(i+1)%views.length;if(e.key==='ArrowLeft')next=(i+views.length-1)%views.length;if(e.key==='Home')next=0;if(e.key==='End')next=views.length-1;if(next>=0){e.preventDefault();switchCategory(views[next]);document.getElementById(id+'-tab-'+views[next])?.focus();}}}>{CATEGORY_LABELS[category]}{searching&&<> <span className="chip-count">{categoryCounts[category]}</span></>}</button>)}</div>
  </div>
  {filmCategory&&<ul className="chip-row quick-filters" aria-label="Quick filters">
   {services.length>0&&<li><button type="button" className="chip" aria-pressed={state.category==='films'&&state.services==='1'} onClick={()=>commit(toggleQuick(state,{services:'1'}))}>On my services</button></li>}
   {quick.map(f=><li key={f.id}><button type="button" className="chip" aria-pressed={state.category==='films'&&quickActive(state,f.filters)} onClick={()=>commit(toggleQuick(state,f.filters))}>{f.label}</button></li>)}
  </ul>}
  {natural&&<div className="catalog-interpretation"><span>Search with filters: {Object.entries(natural.filters).map(([k,v])=>unifiedFilterLabel(k as UnifiedFilter,v!)).join(', ')}{natural.q?' and “'+natural.q+'”':''}</span><button type="button" className="button ghost" onClick={()=>commit({category:'films',q:natural.q,...natural.filters})}>Apply filters</button></div>}
  {activeFilters.length>0&&<ul className="chip-list catalog-active-filters" aria-label="Active filters">{activeFilters.map(key=><li key={key}><button className="chip" type="button" aria-label={'Remove '+unifiedFilterLabel(key,state[key]!)} onClick={()=>setFilter(key,'')}>{unifiedFilterLabel(key,state[key]!)}<Icon name="close" className="x"/></button></li>)}</ul>}
  {state.category!=='all'&&<div className="result-bar catalog-results-summary" aria-live="polite">{activeFilters.length>0&&<button type="button" className="link-button" onClick={clearFilters}>Clear</button>}<span className="result-count">{results.length} {results.length===1?'result':'results'}</span></div>}
  <div id={id+'-results'} className="unified-results" role="tabpanel" aria-label={CATEGORY_LABELS[state.category]+' results'} onClickCapture={e=>{if((e.target as Element).closest('a')){remember();saveVisit();}}}>
   {boundsInvalid&&<p className="notice error" role="alert">The minimum must be no greater than the maximum.</p>}
   {!empty?(state.category==='all'?<div className="all-results">
     {CATEGORIES.filter(c=>perCategory[c].length).map(c=><section key={c} className="all-section" aria-labelledby={id+'-all-'+c}>
      <div className="row-head"><h2 id={id+'-all-'+c}>{CATEGORY_LABELS[c]}</h2>{perCategory[c].length>ALL_LIMIT[c]&&<button type="button" className="link-button" onClick={()=>{switchCategory(c);window.scrollTo(0,0);}}>See all {perCategory[c].length}</button>}</div>
      {renderList(c,perCategory[c].slice(0,ALL_LIMIT[c]))}
     </section>)}
    </div>:<>
    {renderList(state.category,results.slice(0,shown))}
    {shown<results.length&&<div className="pagination-controls" ref={sentinel}><button type="button" className="button ghost" onClick={()=>setShown(n=>n+PAGE)}>Load more</button></div>}
   </>):<div className="empty-state"><Icon name="search" className="empty-icon"/><p>{state.category==='all'?'Nothing matches your search.':'No '+state.category+' match your search.'}</p><p className="muted">Check the spelling, try another name{activeFilters.length?' or remove a filter':''}.</p>{correction&&<p>Did you mean <button type="button" className="link-button" onClick={()=>commit({...state,q:correction})}>{correction}</button>?</p>}{activeFilters.length>0&&<button type="button" className="button ghost" onClick={clearFilters}>Search without filters</button>}{dataView==='films'&&<Link href="/submit">Suggest a film</Link>}</div>}
  </div>
  </>}
  <dialog ref={dialog} id={id+'-filters'} className="modal unified-filter-dialog" aria-labelledby={id+'-filter-title'} onClose={()=>setFiltersOpen(false)} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}>
   <div className="modal-head"><span className="sheet-handle" aria-hidden="true"/><h2 id={id+'-filter-title'}>Filters</h2><button type="button" className="icon-button" aria-label="Close filters" onClick={()=>dialog.current?.close()}><Icon name="close"/></button></div>
   <div className="modal-body">
    <FilterSelect label="Sort by" value={state.sort??(state.q.trim()?'relevance':UNIFIED_SORTS[state.category][0]?.[0]??'')} onChange={e=>commit({...state,sort:e.target.value})}>{state.q.trim()&&<option value="relevance">Relevance</option>}{UNIFIED_SORTS[state.category].map(([value,label])=><option key={value} value={value}>{label}</option>)}</FilterSelect>
    {state.category==='members'&&!data.signedIn&&<p className="muted">Sign in to filter by members you follow and members following you.</p>}
    {CATEGORY_FILTERS[state.category].map(key=>key==='services'?null:key==='following'||key==='followsYou'?<label key={key} className="unified-checkbox"><span>{FILTER_LABELS[key]}</span><input type="checkbox" disabled={!data.signedIn} checked={state[key]==='1'} onChange={e=>setFilter(key,e.target.checked?'1':'')}/></label>:NUMERIC.has(key)?<label key={key} className="field filter-field"><span>{FILTER_LABELS[key]}</span><input aria-label={FILTER_LABELS[key]} type="number" inputMode="numeric" min={key==='from'||key==='to'?1880:0} max={key==='from'||key==='to'?2199:99999} placeholder="Any" key={state.category+':'+key+':'+(state[key]??'')} defaultValue={state[key]??''} onBlur={e=>setFilter(key,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>:<FilterSelect key={key} label={FILTER_LABELS[key]} value={state[key]??''} onChange={e=>setFilter(key,e.target.value)}><option value="">Any</option>{state[key]&&!filterOptions(key).some(([v])=>v===state[key])&&<option value={state[key]}>{unifiedFilterLabel(key,state[key]!)}</option>}{filterOptions(key).map(([value,label])=><option key={value} value={value}>{key==='country'||key==='region'?countryName(value):label}</option>)}</FilterSelect>)}
    {state.category==='films'&&filmFacets.provider.length>0&&<fieldset className="services-picker"><legend>My streaming services</legend><p className="muted">Pick the services you have. “On my services” then shows only films you can watch on them. Saved on this device.</p><div className="chip-row filter-choices">{filmFacets.provider.map(p=><button key={p} type="button" className="button ghost" aria-pressed={services.includes(p)} onClick={()=>saveServices(services.includes(p)?services.filter(x=>x!==p):[...services,p])}>{p}</button>)}</div></fieldset>}
    {boundsInvalid&&<p className="notice error" role="alert">The minimum must be no greater than the maximum.</p>}
   </div>
   <div className="modal-foot"><button type="button" className="button ghost" onClick={()=>commit({category:state.category,q:state.q})}>Reset</button><button type="button" className="button" onClick={()=>dialog.current?.close()}>Show {activeSearch?results.length+' ':''}{state.category}</button></div>
  </dialog>
 </div>;
}
