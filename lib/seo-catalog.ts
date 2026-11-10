import {unstable_cache} from 'next/cache';
import {createClient} from '@supabase/supabase-js';
import {getFilms,getDirectors} from './data';
import {SUPABASE_URL,SUPABASE_ANON_KEY,supabaseEnabled} from './supabase/config';
type Catalog={films:{id:string;slug:string}[];directors:{id:string;slug:string}[];people:{id:string;slug:string}[]};

/** Public IDs and slugs only. Shared caching prevents parallel sitemap requests loading full biographies and film content. */
export const seoCatalog=unstable_cache(async():Promise<Catalog>=>{
 if(!supabaseEnabled){
  const [films,directors]=await Promise.all([getFilms(),getDirectors()]);
  const directorIds=new Set(directors.map(d=>d.id));
  const people=new Map(films.flatMap(f=>f.credits.filter(c=>!directorIds.has(c.person.id)).map(c=>[c.person.id,{id:c.person.id,slug:c.person.slug}]as const)));
  return{films:films.map(f=>({id:f.id,slug:f.slug})),directors:directors.map(d=>({id:d.id,slug:d.slug})),people:[...people.values()]};
 }
 const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const films:{id:string;slug:string}[]=[];
 for(let from=0;;from+=1000){
  const {data,error}=await db.from('films').select('id,slug').eq('status','published').order('id').range(from,from+999);
  if(error)throw Error('Could not load sitemap film slugs: '+error.message);
  films.push(...data??[]);if(!data||data.length<1000)break;
 }
 const people=new Map<string,{id:string;slug:string}>(),directors=new Map<string,{id:string;slug:string}>();
 // Bound each credits query to 100 published films, and page even within that batch.
 for(let start=0;start<films.length;start+=100){
  const ids=films.slice(start,start+100).map(f=>f.id);
  for(let from=0;;from+=1000){
   const {data,error}=await db.from('credits').select('person_id,role,people!inner(id,slug,in_directory)').in('film_id',ids).order('film_id').order('person_id').order('role').range(from,from+999);
   if(error)throw Error('Could not load sitemap people slugs: '+error.message);
   for(const row of (data??[]) as unknown as {person_id:string;role:string;people:{id:string;slug:string;in_directory:boolean|null}}[]){
    const person={id:row.people.id,slug:row.people.slug};people.set(person.id,person);
    if(row.role==='director'&&row.people.in_directory!==false)directors.set(person.id,person);
   }
   if(!data||data.length<1000)break;
  }
 }
 for(const id of directors.keys())people.delete(id);
 return{films,directors:[...directors.values()],people:[...people.values()]};
},['seo-public-catalog-slugs-v1',SUPABASE_URL||'starter'],{revalidate:3600,tags:['seo-catalog']});
