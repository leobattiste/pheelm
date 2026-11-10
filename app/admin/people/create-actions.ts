'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {adminClient} from '@/lib/admin';
import {logAdminActivity} from '@/lib/admin-activity';
import {slugify} from '@/lib/format';
import {ALL_COUNTRIES} from '@/lib/countries';
import {getPersonDetails,tmdbEnabled} from '@/lib/tmdb';
export type CreatePersonState={ok:boolean;message:string}|null;
export async function createPerson(_state:CreatePersonState,form:FormData):Promise<CreatePersonState> {
 let id:string;
 try{
  const db=await adminClient();
  const name=String(form.get('name')??'').trim(),country=String(form.get('country')??'').trim().toUpperCase(),rawTmdb=String(form.get('tmdb_id')??'').trim();
  if(!name||name.length>200)return{ok:false,message:'Enter a name, up to 200 characters.'};
  if(country&&!ALL_COUNTRIES[country])return{ok:false,message:'Choose a valid country.'};
  if(rawTmdb&&(!/^\d+$/.test(rawTmdb)||!Number.isSafeInteger(Number(rawTmdb))||Number(rawTmdb)<1))return{ok:false,message:'Enter a valid TMDB person ID.'};
  const tmdb=rawTmdb?Number(rawTmdb):null;
  const slug=slugify(name)||`director-${crypto.randomUUID().slice(0,8)}`;
  const existing=await db.from('people').select('id').eq(tmdb?'tmdb_id':'slug',tmdb??slug).maybeSingle();
  if(existing.error)throw new Error(existing.error.message);
  if(existing.data){id=existing.data.id;}
  else{
   if(tmdb&&!tmdbEnabled)return{ok:false,message:'Import is currently unavailable. Clear the TMDB ID to add the director manually.'};
   const details=tmdb?await getPersonDetails(tmdb):null;
   const {data,error}=await db.from('people').insert({name,slug,country:country||null,tmdb_id:tmdb,in_directory:false,bio:details?.bio??null,photo_url:details?.photo_url??null,birth_year:details?.birth_year??null}).select('id').single();
   if(error||!data)return{ok:false,message:error?.code==='23505'?'A person with that name or TMDB ID already exists. Search for them before adding another record.':'Could not add the director. Try again.'};
   id=data.id;
   await logAdminActivity(db,'Created person','person',id,name);
  }
 }catch(error){return{ok:false,message:error instanceof Error?error.message:'Could not add the director. Try again.'};}
 revalidatePath('/admin/people');
 redirect(`/admin/people/${id}`);
}
