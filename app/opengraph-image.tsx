import {getFilms} from '@/lib/data';
import {PUBLIC_PAGES} from '@/lib/seo';
import {shareImage} from '@/lib/share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Pheelm — Discover films by Black directors around the world';
export const revalidate=3600;
export default async function Image(){
 const films=await getFilms(),page=PUBLIC_PAGES['/'];
 return shareImage({...page,image:films.find(f=>f.featured&&f.poster_url)?.poster_url??films.find(f=>f.poster_url)?.poster_url});
}
