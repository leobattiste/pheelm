import {getFilms} from '@/lib/data';
import {PUBLIC_PAGES} from '@/lib/seo';
import {shareImage} from '@/lib/share-image';
export const revalidate=3600;
export async function GET(request:Request){
 const path=new URL(request.url).searchParams.get('page')??'/';
 const page=Object.hasOwn(PUBLIC_PAGES,path)?PUBLIC_PAGES[path]:null;if(!page)return new Response('Not found',{status:404});
 const films=await getFilms();
 return shareImage({...page,image:films.find(f=>f.featured&&f.poster_url)?.poster_url??films.find(f=>f.poster_url)?.poster_url});
}
