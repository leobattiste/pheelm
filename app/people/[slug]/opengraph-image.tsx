import {getPerson} from '@/lib/data';
import {shareImage} from '@/lib/share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Cast and crew on Pheelm';
export const revalidate=3600;
export async function generateStaticParams(){return [];}
export default async function Image({params}:{params:Promise<{slug:string}>}){
 const found=await getPerson((await params).slug);
 return shareImage(found?{title:found.person.name,label:'Cast and crew',description:found.person.bio??`Explore the films and work of ${found.person.name}.`,image:found.person.photo_url}:{title:'Pheelm',label:'Cast and crew'});
}
