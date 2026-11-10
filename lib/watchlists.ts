import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getServerClient } from './supabase/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from './supabase/config';

export type Watchlist = {
 id:string;slug:string;title:string;description:string|null;is_public:boolean;hidden:boolean;staff_pick:boolean;user_id:string;
 comments_enabled?:boolean;pinned_comment_id?:string|null;
 list_films:{film_id:string;added_at:string;added_by?:string|null}[];
};

/** Shared only inside this request; all access is evaluated using the actual visitor's RLS. */
export const getWatchlist=cache(async(slug:string):Promise<Watchlist|null>=>{
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>120)return null;
 const db=await getServerClient();if(!db)return null;
 const {data,error}=await db.from('lists').select('id,slug,title,description,is_public,hidden,staff_pick,user_id,comments_enabled,pinned_comment_id,list_films(film_id,added_at,added_by)').eq('slug',slug).maybeSingle();
 if(error)throw Error('Could not load this watchlist.');
 return data as Watchlist|null;
});

/** No cookies or private content enter the sitemap, including hidden lists visible to admins. */
export async function getPublicWatchlists():Promise<{id:string;slug:string;updated_at:string}[]> {
 if(!supabaseEnabled)return [];
 const db=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:false}});
 const out:{id:string;slug:string;updated_at:string}[]=[];
 for(let from=0;;from+=1000){
  const {data,error}=await db.from('lists').select('id,slug,updated_at').eq('is_public',true).eq('hidden',false).order('id').range(from,from+999);
  if(error)throw Error('Could not load public watchlists for the sitemap.');
  out.push(...data??[]);if(!data||data.length<1000)return out;
 }
}
