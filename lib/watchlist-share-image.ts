import {createClient} from '@supabase/supabase-js';
import {getFilms} from './data';
import {shareImage} from './share-image';
import {SUPABASE_URL,SUPABASE_ANON_KEY,supabaseEnabled} from './supabase/config';
export async function watchlistShareImage(value:string,by:'id'|'slug'){
 const db=supabaseEnabled?createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false}}):null;
 const valid=by==='slug'?/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)&&value.length<=120:/^[0-9a-f-]{36}$/i.test(value);
 const result=db&&valid?await db.from('lists').select('title,description,staff_pick,list_films(film_id,added_at)').eq(by,value).eq('is_public',true).eq('hidden',false).maybeSingle():null;
 if(!result?.data)return shareImage({title:'Pheelm',label:'Watchlists',cache:600});
 const films=await getFilms(),list=result.data;
 const byId=new Map(films.map(f=>[f.id,f]));
 const entries=(list.list_films as {film_id:string;added_at:string}[]).sort((a,b)=>list.staff_pick?(byId.get(a.film_id)?.year??0)-(byId.get(b.film_id)?.year??0):b.added_at.localeCompare(a.added_at));
 const image=entries.map(e=>byId.get(e.film_id)).find(f=>f?.poster_url)?.poster_url;
 // Public data, so the CDN keeps it for 10 minutes: a watchlist made private drops out within that.
 return shareImage({title:list.title,label:'Watchlist',description:list.description,image,cache:600});
}
