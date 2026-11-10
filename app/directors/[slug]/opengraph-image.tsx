import {getDirector} from '@/lib/data';
import {shareImage} from '@/lib/share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Directors on Pheelm';
export const revalidate=3600;
export async function generateStaticParams(){return [];}
export default async function Image({params}:{params:Promise<{slug:string}>}){
 const director=await getDirector((await params).slug);
 return shareImage(director?{title:director.name,label:'Director',description:director.bio??`Explore films directed by ${director.name}.`,image:director.photo_url}:{title:'Pheelm',label:'Directors'});
}
