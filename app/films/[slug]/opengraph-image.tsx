import {getFilm} from '@/lib/data';
import {shareImage} from '@/lib/share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Films on Pheelm';
export const revalidate=3600;
export async function generateStaticParams(){return [];}
export default async function Image({params}:{params:Promise<{slug:string}>}){
 const film=await getFilm((await params).slug);
 return shareImage(film?{title:film.title,label:`Film · ${film.year}`,description:film.directors.map(d=>d.name).join(' and '),image:film.poster_url}:{title:'Pheelm',label:'Films'});
}
