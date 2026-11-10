import type { Metadata } from 'next';
import type { Member } from './community';
import { SITE_URL } from './supabase/config';
import { socialLink, websiteUrl } from './profile-links';

export function profileMetadata(member:Member|null):Metadata {
 if(!member)return {title:'Profile not found',alternates:{canonical:null},robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};
 if(member.is_private)return {title:`@${member.handle}`,description:'This profile is private.',alternates:{canonical:null},robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};
 const title=member.display_name?`${member.display_name} (@${member.handle})`:`@${member.handle}`;
 const description=member.bio?.replace(/\s+/g,' ').trim().slice(0,160) || `Explore @${member.handle}’s watchlists, watched films and favorite directors on Pheelm.`;
 const url=`/@${member.handle}`;
 const images=[{url:`/@${member.handle}/opengraph-image`,width:1200,height:630,alt:`${member.display_name || member.handle} on Pheelm`}];
 return {title,description,alternates:{canonical:url},robots:{index:true,follow:true},openGraph:{type:'profile',title,description,url,username:member.handle,...(images?{images}:{})},twitter:{card:'summary_large_image',title,description,...(images?{images}:{})}};
}
export function profileStructuredData(member:Member){
 if(member.is_private)return null;
 const url=`${SITE_URL}/@${member.handle}`;
 const sameAs:string[]=[];
 try{const social=socialLink(member.social_platform??'',member.social_url??'');if(social.url)sameAs.push(social.url);}catch{}
 try{const website=websiteUrl(member.website_url??'');if(website)sameAs.push(website);}catch{}
 return {'@context':'https://schema.org','@type':'ProfilePage',url,mainEntity:{'@type':'Person','@id':url+'#person',name:member.display_name || '@'+member.handle,alternateName:'@'+member.handle,url,...(member.bio?{description:member.bio.slice(0,160)}:{}),...(member.avatar_url?{image:member.avatar_url}:{}),...(sameAs.length?{sameAs}:{})}};
}
