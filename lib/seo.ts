import type { Metadata } from 'next';
import { PAGE_COPY, SITE_DESCRIPTION, SITE_NAME } from './site';

export const PUBLIC_PAGES:Record<string,{title:string;description:string;label:string}>={
 '/':{title:'Discover films by Black directors',description:SITE_DESCRIPTION,label:'Black cinema around the world'},
 '/films':{title:'Films',description:PAGE_COPY.films,label:'Discover'},
 '/directors':{title:'Directors',description:PAGE_COPY.directors,label:'Filmmakers'},
 '/watchlists':{title:'Watchlists',description:PAGE_COPY.collections,label:'Community'},
 '/about':{title:'About Pheelm',description:'Discover the mission behind Pheelm, an independent platform celebrating films directed by Black filmmakers around the world.',label:'About'},
 '/partnerships':{title:'Partnerships',description:'Partner with Pheelm on screenings, editorial collaborations, educational projects and community initiatives celebrating Black cinema.',label:'Work with us'},
 '/contact':{title:'Contact',description:'Contact Pheelm for general enquiries, press and privacy requests at hey@pheelm.com.',label:'Get in touch'},
 '/help':{title:'Help',description:'Find answers about discovering films, watchlists, accounts, privacy and using Pheelm.',label:'Help center'},
 '/legal':{title:'Legal',description:'Read Pheelm’s Privacy Policy, Copyright Policy, Terms of Use and Community Guidelines. Contact hey@pheelm.com for legal inquiries.',label:'Privacy, rights and community'},
 '/donate':{title:'Support Pheelm',description:'Help keep Pheelm independent, accessible and growing. Support the discovery of films by Black directors from around the world.',label:'For the love of cinema'},
 '/newsletter':{title:'Pheelm Digest',description:'Discover new films, directors and community watchlists from Pheelm by email.',label:'Stay in the picture'},
 '/feedback':{title:'Feedback',description:'Report a problem, suggest an improvement or help correct film information on Pheelm.',label:'Help improve Pheelm'},
 '/submit':{title:'Suggest a film',description:PAGE_COPY.submit,label:'Help grow the catalog'},
 '/submit/your-film':{title:'Submit your film',description:'Own a film or represent its rights holder? Submit its information for review and help film lovers discover it on Pheelm.',label:'For filmmakers'},
};
export function seoText(value:string,max=160):string {
 const text=value.replace(/\s+/g,' ').trim();return text.length>max?text.slice(0,max-1).trimEnd()+'…':text;
}
export function pageMetadata(title:string,description:string,path:string,image=`/api/og?page=${encodeURIComponent(path)}`,type:'website'|'profile'='website'):Metadata {
 const summary=seoText(description);
 const images=[{url:image,width:1200,height:630,alt:seoText(`${title} | ${SITE_NAME}`,180)}];
 return {title,description:summary,alternates:{canonical:path},robots:{index:true,follow:true,googleBot:{index:true,follow:true,'max-image-preview':'large'}},
  openGraph:{type,siteName:SITE_NAME,locale:'en_US',title,description:summary,url:path,images},
  twitter:{card:'summary_large_image',title,description:summary,images},
 };
}
export function publicPageMetadata(path:string):Metadata {
 const page=PUBLIC_PAGES[path];if(!page)throw Error('Unknown public page: '+path);
 return pageMetadata(page.title,page.description,path,path==='/'?'/opengraph-image':undefined);
}
export function privateMetadata(title:string):Metadata {
 const metadata=pageMetadata(title,'Manage your Pheelm account securely.','/','/opengraph-image');
 return {...metadata,alternates:{canonical:null},robots:{index:false,follow:false,googleBot:{index:false,follow:false}}};
}
