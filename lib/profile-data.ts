import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnabled } from './supabase/config';
import type { Award, CollectionTileData, DirectorSummary, FilmCard } from './types';

// These reads use public catalog permissions. Private activity is read separately as the viewer.
const publicDb = () => supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:false}}) : null;
const FILM_COLUMNS = 'id,slug,title,year,type,countries,languages,genres,poster_url,color,runtime,awards,credits(role,sort,people(name))';
type CardRow = Omit<FilmCard, 'directors'|'wins'> & {awards:Award[]|null;credits:{role:string;sort:number;people:{name:string}|null}[]};
function card(row:CardRow):FilmCard {
 return {id:row.id,slug:row.slug,title:row.title,year:row.year,type:row.type,countries:row.countries,languages:row.languages,genres:row.genres,poster_url:row.poster_url,color:row.color??null,runtime:row.runtime??null,wins:(row.awards??[]).filter(a=>a.result==='won').length,directors:[...(row.credits??[])].filter(c=>c.role==='director'&&c.people).sort((a,b)=>a.sort-b.sort).map(c=>c.people!.name)};
}
const chunks = <T,>(values:T[]) => Array.from({length:Math.ceil(values.length/100)},(_,i)=>values.slice(i*100,(i+1)*100));

/** Only requested published film cards, never the whole catalog or cast biographies. */
export async function getProfileFilmCards(ids:string[]):Promise<FilmCard[]> {
 const db=publicDb();if(!db||!ids.length)return [];
 const rows=await Promise.all(chunks([...new Set(ids)]).map(async batch=>{
  const {data,error}=await db.from('films').select(FILM_COLUMNS).in('id',batch).eq('status','published').eq('credits.role','director');
  if(error)throw Error('Could not load profile film cards: '+error.message);
  return (data??[]) as unknown as CardRow[];
 }));
 const byId=new Map(rows.flat().map(row=>[row.id,card(row)]));
 return ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
}

type ListRow={id:string;title:string;staff_pick:boolean;created_at:string;user_id:string;list_films:{film_id:string;added_at:string;films:{year:number;status:string}}[]};
export type ProfileCollection={tile:CollectionTileData;count:number};

/** Only the three covers are rendered, but the count includes every published film. */
async function collectionCards(rows:ListRow[]):Promise<ProfileCollection[]> {
 const db=publicDb();if(!db||!rows.length)return [];
 const orderedFilms=new Map(rows.map(row=>[row.id,[...row.list_films].filter(f=>f.films?.status==='published').sort((a,b)=>row.staff_pick?a.films.year-b.films.year:b.added_at.localeCompare(a.added_at))]));
 const [films,owners,saves]=await Promise.all([
  getProfileFilmCards([...new Set([...orderedFilms.values()].flatMap(list=>list.slice(0,3).map(f=>f.film_id)))]),
  db.from('member_profiles').select('id,handle').in('id',[...new Set(rows.map(r=>r.user_id))]),
  db.from('list_save_counts').select('list_id,saves').in('list_id',rows.map(r=>r.id)),
 ]);
 if(owners.error||saves.error)throw Error('Could not load profile collection details.');
 const filmsById=new Map(films.map(f=>[f.id,f]));
 const ownersById=new Map((owners.data??[]).map(o=>[o.id,o]));
 const savesById=new Map((saves.data??[]).map(s=>[s.list_id,s.saves as number]));
 return [...rows].sort((a,b)=>Number(b.staff_pick)-Number(a.staff_pick)||(savesById.get(b.id)??0)-(savesById.get(a.id)??0)||b.created_at.localeCompare(a.created_at)).map(row=>{
  const ordered=orderedFilms.get(row.id)??[];
  const selected=ordered.slice(0,3).flatMap(f=>filmsById.has(f.film_id)?[filmsById.get(f.film_id)!]:[]);
  return {count:ordered.length,tile:{id:row.id,title:row.title,owner:ownersById.get(row.user_id)??null,films:selected.slice(0,3).map(f=>({id:f.id,title:f.title,year:f.year,poster_url:f.poster_url,color:f.color,directors:f.directors.map(name=>({name}))}))}};
 });
}

export async function getProfileCollections(memberId:string):Promise<ProfileCollection[]> {
 const db=publicDb();if(!db)return [];
 const {data,error}=await db.from('lists').select('id,title,staff_pick,created_at,user_id,list_films(film_id,added_at,films!inner(year,status))').eq('is_public',true).eq('list_films.films.status','published').eq('user_id',memberId).order('created_at',{ascending:false});
 if(error)throw Error('Could not load profile collections: '+error.message);
 return collectionCards((data??[]) as unknown as ListRow[]);
}

export async function getProfileCollaborations(memberId:string):Promise<ProfileCollection[]> {
 const db=publicDb();if(!db)return [];
 const {data:memberships,error}=await db.from('list_members').select('list_id').eq('user_id',memberId).eq('status','active');
 if(error)throw Error('Could not load profile collaborations: '+error.message);
 if(!memberships?.length)return [];
 const {data,error:listError}=await db.from('lists').select('id,title,staff_pick,created_at,user_id,list_films(film_id,added_at,films!inner(year,status))').eq('is_public',true).eq('list_films.films.status','published').neq('user_id',memberId).in('id',memberships.map(m=>m.list_id));
 if(listError)throw Error('Could not load shared collections: '+listError.message);
 return collectionCards((data??[]) as unknown as ListRow[]);
}

/** Only followed directors and their published directing credits; previews match catalog ordering. */
export async function getProfileDirectorCards(ids:string[]):Promise<DirectorSummary[]> {
 const db=publicDb();if(!db||!ids.length)return [];
 const batches=await Promise.all(chunks([...new Set(ids)]).map(async batch=>{
  const people=await db.from('people').select('id,slug,name,country,photo_url,in_directory').in('id',batch);
  if(people.error)throw Error('Could not load followed directors: '+people.error.message);
  type DirectedRow={person_id:string;film_id:string;films:CardRow};
  const credits:DirectedRow[]=[];
  for(let from=0;;from+=1000){
   const result=await db.from('credits').select(`person_id,film_id,films!inner(${FILM_COLUMNS})`).in('person_id',batch).eq('role','director').eq('films.status','published').eq('films.credits.role','director').order('person_id').order('film_id').range(from,from+999);
   if(result.error)throw Error('Could not load director previews: '+result.error.message);
   const rows=(result.data??[]) as unknown as DirectedRow[];credits.push(...rows);if(rows.length<1000)break;
  }
  return (people.data??[]).filter(p=>p.in_directory!==false).flatMap(p=>{
   const films=credits.filter(c=>c.person_id===p.id).map(c=>card(c.films));if(!films.length)return [];
   const years=films.map(f=>f.year);
   return [{id:p.id,slug:p.slug,name:p.name,country:p.country,photo_url:p.photo_url,films:films.length,first:Math.min(...years),last:Math.max(...years),previews:films.sort((a,b)=>Number(!!b.poster_url)-Number(!!a.poster_url)||b.wins-a.wins||b.year-a.year).slice(0,3).map(f=>({slug:f.slug,title:f.title,year:f.year,poster_url:f.poster_url,color:f.color??null,directors:f.directors}))}];
  });
 }));
 const byId=new Map(batches.flat().map(d=>[d.id,d]));return ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
}
