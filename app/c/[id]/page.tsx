import { notFound, permanentRedirect } from 'next/navigation';
import { getServerClient } from '@/lib/supabase/server';
import { watchlistPath } from '@/lib/watchlist-links';

export const dynamic = 'force-dynamic';

/** Existing UUID links retain access checks and permanently resolve to the canonical name. */
export default async function LegacyWatchlist({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const {id}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))notFound();
 const db=await getServerClient();
 const result=db?await db.from('lists').select('id,slug').eq('id',id).maybeSingle():null;
 if(!result?.data)notFound();
 const query=new URLSearchParams();
 for(const [key,value]of Object.entries(await searchParams)){
  if(Array.isArray(value))for(const entry of value)query.append(key,entry);
  else if(value!==undefined)query.set(key,value);
 }
 permanentRedirect(watchlistPath(result.data)+(query.size?'?'+query.toString():''));
}
