import { indexEntries, relevance, spellingCorrection, type SearchEntry } from './catalog-search';
import { countryName } from './format';
import type { CollectionTileData } from './types';

export const CATEGORIES = ['films', 'directors', 'watchlists', 'members'] as const;
export type SearchCategory = typeof CATEGORIES[number];
export const CATEGORY_LABELS: Record<SearchCategory, string> = {films:'Films', directors:'Directors', watchlists:'Watchlists', members:'Members'};
export type SearchWatchlist = {
 id:string; slug?:string; title:string; description:string|null; is_public:boolean; featured:boolean; staff_pick:boolean;
 owner:{id:string;handle:string;display_name:string|null}|null; filmIds:string[]; tile:CollectionTileData;
 updated_at:string; created_at:string; saves:number;
};
export type SearchMember = {id:string;handle:string;display_name:string|null;avatar_url:string|null;country:string|null;bio:string|null;following:boolean;followsYou:boolean};
export type UnifiedSearchEntry = Omit<SearchEntry,'filmography'> & {filmography:{year:number;type:string;genres?:string[]}[]};
export type UnifiedSearchData = {films:UnifiedSearchEntry[];directors:UnifiedSearchEntry[];watchlists:SearchWatchlist[];members:SearchMember[];signedIn:boolean;viewerId:string|null};
export const CATEGORY_FILTERS = {
 films:['genre','country','language','from','to','minRuntime','maxRuntime','type','award','festival','provider','region','availability'],
 directors:['country','genre','from','to'], watchlists:['genre','min','max','updated'], members:['following','followsYou'],
} as const;
export type UnifiedFilter = typeof CATEGORY_FILTERS[SearchCategory][number];
export type UnifiedSearchState = {category:SearchCategory;q:string;sort?:string}&Partial<Record<UnifiedFilter,string>>;
export const UNIFIED_SORTS:Record<SearchCategory,[string,string][]> = {
 films:[['newest','Newest films'],['oldest','Oldest films'],['title','A to Z'],['added','Latest added'],['awards','Most awarded']],
 directors:[['title','A to Z'],['count','Most films'],['newest','Most recent films']],
 watchlists:[['updated','Recently updated'],['added','Newest watchlists'],['count','Most films'],['title','A to Z']],
 members:[['title','Name A to Z'],['handle','Username A to Z']],
};
const allFilters = [...new Set(Object.values(CATEGORY_FILTERS).flat())];
export function cleanUnifiedState(params:URLSearchParams):UnifiedSearchState {
 const category=CATEGORIES.includes(params.get('category') as SearchCategory)?params.get('category') as SearchCategory:'films';
 const state:UnifiedSearchState={category,q:(params.get('q')??'').slice(0,200)};
 const sort=params.get('sort');
 if(sort&&(sort==='relevance'&&!!state.q.trim()||UNIFIED_SORTS[category].some(([s])=>s===sort)))state.sort=sort;
 for(const key of CATEGORY_FILTERS[category]) {
  const value=params.get(key)?.trim().slice(0,120); if(!value)continue;
  if(['from','to'].includes(key)&&(!/^\d{4}$/.test(value)||+value<1880||+value>2199))continue;
  if(['minRuntime','maxRuntime','min','max'].includes(key)&&(!/^\d{1,5}$/.test(value)||+value<0))continue;
  if(['following','followsYou'].includes(key)&&value!=='1')continue;
  if(key==='updated'&&!['7','30','90'].includes(value))continue;
  if(key==='award'&&!['won','nominated'].includes(value))continue;
  if(key==='availability'&&!['stream','rent','buy','free'].includes(value))continue;
  state[key]=value;
 }
 return state;
}
export function unifiedQuery(state:UnifiedSearchState) {
 const params=new URLSearchParams(); if(state.category!=='films')params.set('category',state.category);
 if(state.q)params.set('q',state.q);if(state.sort)params.set('sort',state.sort);
 for(const key of allFilters)if(state[key])params.set(key,state[key]!);
 return params.toString();
}
export const activeUnifiedFilters=(state:UnifiedSearchState):UnifiedFilter[]=>CATEGORY_FILTERS[state.category].filter(key=>!!state[key]);
export function unifiedFilterLabel(key:UnifiedFilter,value:string) {
 if(key==='country'||key==='region')return (key==='region'?'Available in ':'')+countryName(value);
 if(key==='from')return 'From '+value;if(key==='to')return 'Through '+value;
 if(key==='minRuntime')return value+'+ min';if(key==='maxRuntime')return 'Up to '+value+' min';
 if(key==='min')return value+'+ films';if(key==='max')return 'Up to '+value+' films';
 if(key==='updated')return 'Updated in last '+value+' days';
 if(key==='following')return 'Members you follow';if(key==='followsYou')return 'Members following you';
 if(key==='award')return value==='won'?'Award winners':'Award nominees';
 if(key==='type')return ({feature:'Feature',documentary:'Documentary',short:'Short',animation:'Animation'} as Record<string,string>)[value]??value;
 if(key==='availability')return ({stream:'Streaming',rent:'Rent',buy:'Buy',free:'Free'} as Record<string,string>)[value]??value;
 return value;
}
export type UnifiedResult = {id:string;title:string;image:string|null;subtitle:string;href:string;entry?:SearchEntry;watchlist?:SearchWatchlist;member?:SearchMember;genres:string[];years:number[];count:number;added:number;updated:number;score:number};
const date=(value:string)=>Date.parse(value)||0;
export function unifiedResults(data:UnifiedSearchData,category:SearchCategory):UnifiedResult[] {
 if(category==='films'||category==='directors')return data[category].map(entry=>({id:entry.id,title:entry.title,image:entry.image,subtitle:entry.subtitle,href:`/${category}/${encodeURIComponent(entry.slug)}`,entry,genres:entry.genres,years:entry.years,count:entry.count,added:entry.added,updated:entry.added,score:0}));
 if(category==='watchlists') {
  const films=new Map(data.films.map(f=>[f.id,f]));
  return data.watchlists.map(w=>({id:w.id,title:w.title,image:w.tile.films[0]?.poster_url??null,subtitle:[w.owner?'@'+w.owner.handle:'',w.filmIds.length+' films'].filter(Boolean).join(' • '),href:w.slug?'/watchlists/'+encodeURIComponent(w.slug):'/c/'+encodeURIComponent(w.id),watchlist:w,genres:[...new Set(w.filmIds.flatMap(id=>films.get(id)?.genres??[]))],years:[],count:w.filmIds.length,added:date(w.created_at),updated:date(w.updated_at),score:0}));
 }
 return data.members.map(member=>({id:member.id,title:member.display_name||member.handle,image:member.avatar_url,subtitle:'@'+member.handle,href:'/@'+encodeURIComponent(member.handle),member,genres:[],years:[],count:0,added:0,updated:0,score:0}));
}
function indexedResult(result:UnifiedResult) {
 return indexEntries([result.entry??{id:result.id,slug:result.id,title:result.title,image:result.image,subtitle:result.subtitle,aliases:result.member?[result.member.handle,'@'+result.member.handle]:[],names:result.watchlist?[result.watchlist.owner?.handle??'',result.watchlist.owner?.display_name??'']:[],countries:[],languages:[],genres:result.genres,types:[],years:[],runtime:null,wins:0,nominations:0,awards:[],availability:[],added:result.added,count:result.count,filmography:[]}])[0];
}
export function indexUnified(data:UnifiedSearchData,category:SearchCategory) {
 return unifiedResults(data,category).map(result=>({result,index:indexedResult(result)}));
}
export function searchUnified(index:ReturnType<typeof indexUnified>,state:UnifiedSearchState,now=Date.now()):UnifiedResult[] {
 const sort=state.sort??(state.q.trim()?'relevance':state.category==='films'?'newest':state.category==='watchlists'?'updated':'title');
 return index.filter(({result:r})=>{
  const e=r.entry;
  if(state.country&&!e?.countries.includes(state.country)||state.language&&!e?.languages.includes(state.language)||state.genre&&!r.genres.includes(state.genre)||state.type&&!e?.types.includes(state.type))return false;
  if(state.category==='directors'&&(state.genre||state.from||state.to)&&!(e as UnifiedSearchEntry)?.filmography.some(f=>(!state.genre||(f.genres??[]).includes(state.genre))&&(!state.from||f.year>=+state.from)&&(!state.to||f.year<=+state.to)))return false;
  if((state.from||state.to)&&!r.years.some(y=>(!state.from||y>=+state.from)&&(!state.to||y<=+state.to)))return false;
  if(state.minRuntime&&(e?.runtime==null||e.runtime<+state.minRuntime)||state.maxRuntime&&(e?.runtime==null||e.runtime>+state.maxRuntime))return false;
  if(state.award==='won'&&!e?.wins||state.award==='nominated'&&!e?.nominations||state.festival&&!e?.awards.includes(state.festival))return false;
  if((state.provider||state.region||state.availability)&&!e?.availability.some(a=>(!state.provider||a.provider===state.provider)&&(!state.region||a.region===state.region)&&(!state.availability||a.kind===state.availability)))return false;
  if(state.min&&r.count<+state.min||state.max&&r.count>+state.max)return false;
  if(state.updated&&r.updated<now-+state.updated*86400000)return false;
  if(state.following&&!r.member?.following||state.followsYou&&!r.member?.followsYou)return false;
  return true;
 }).map(({result,index})=>({...result,score:relevance(index,state.q)})).filter(r=>r.score>0).sort((a,b)=>{
  if(sort==='relevance'&&state.q.trim()&&a.score!==b.score)return b.score-a.score;
  if(sort==='newest')return Math.max(0,...b.years)-Math.max(0,...a.years)||a.title.localeCompare(b.title);
  if(sort==='oldest')return Math.min(...a.years)-Math.min(...b.years)||a.title.localeCompare(b.title);
  if(sort==='added')return b.added-a.added||a.title.localeCompare(b.title);
  if(sort==='updated')return b.updated-a.updated||a.title.localeCompare(b.title);
  if(sort==='count')return b.count-a.count||a.title.localeCompare(b.title);
  if(sort==='awards')return (b.entry?.wins??0)-(a.entry?.wins??0)||a.title.localeCompare(b.title);
  if(sort==='handle')return (a.member?.handle??'').localeCompare(b.member?.handle??'');
  return a.title.localeCompare(b.title);
 });
}
export function unifiedCorrection(index:ReturnType<typeof indexUnified>,q:string) {return spellingCorrection(index.map(i=>i.index),q);}
export function unifiedFacets(index:ReturnType<typeof indexUnified>) {
 const unique=(values:string[])=>[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 return {country:unique(index.flatMap(i=>i.result.entry?.countries??[])),language:unique(index.flatMap(i=>i.result.entry?.languages??[])),genre:unique(index.flatMap(i=>i.result.genres)),type:unique(index.flatMap(i=>i.result.entry?.types??[])),festival:unique(index.flatMap(i=>i.result.entry?.awards??[])),provider:unique(index.flatMap(i=>i.result.entry?.availability.map(a=>a.provider)??[])),region:unique(index.flatMap(i=>i.result.entry?.availability.map(a=>a.region)??[]))};
}
