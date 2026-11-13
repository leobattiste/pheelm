import {getMemberProfile} from '@/lib/community';
import {shareImage} from '@/lib/share-image';
export const size={width:1200,height:630};
export const contentType='image/png';
export const alt='Community profiles on Pheelm';
// Rendered at most every 10 minutes per profile, not on every request.
export const revalidate=600;
// None built ahead of time; each is cached the first time it's asked for.
export function generateStaticParams(){return [];}
export default async function Image({params}:{params:Promise<{member:string}>}){
 const segment=(await params).member;
 const handle=/^@[a-z0-9_]{3,24}$/i.test(segment)?segment.slice(1).toLowerCase():null;
 const member=handle?await getMemberProfile(handle):null;
 return shareImage(member&&!member.is_private?{title:member.display_name||'@'+member.handle,label:'@'+member.handle,description:member.bio??'Explore community watchlists and discover films on Pheelm.',image:member.avatar_url,cache:600}:{title:'Pheelm',label:'Community',cache:600});
}
