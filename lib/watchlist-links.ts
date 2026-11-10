import type { Metadata } from 'next';

/** ID fallback exists only for old records and links created before the slug migration. */
export function watchlistPath(list:{id:string;slug?:string|null}):string {
 return list.slug?`/watchlists/${encodeURIComponent(list.slug)}`:`/c/${encodeURIComponent(list.id)}`;
}

type SeoWatchlist={id:string;slug:string;title:string;description:string|null;is_public:boolean;hidden?:boolean};
export function watchlistMetadata(list:SeoWatchlist|null):Metadata {
 if(!list || !list.is_public || list.hidden)return {
  title:list?'Private watchlist':'Watchlist not found',
  alternates:{canonical:null},
  description:list?'This watchlist is not publicly available.':'This watchlist could not be found.',
  robots:{index:false,follow:false,googleBot:{index:false,follow:false}},
  openGraph:{title:'Watchlist',description:'Discover watchlists on Pheelm.',images:[]},
  twitter:{card:'summary',title:'Watchlist',description:'Discover watchlists on Pheelm.',images:[]},
 };
 const url=watchlistPath(list);
 const text=list.description?.replace(/\s+/g,' ').trim();
 const description=text?(text.length>160?text.slice(0,157).trimEnd()+'…':text):`Explore ${list.title}, a watchlist of films by Black directors on Pheelm.`;
 const images=[{url:url+'/opengraph-image',width:1200,height:630,alt:list.title+' — Watchlist on Pheelm'}];
 return {title:list.title,description,alternates:{canonical:url},robots:{index:true,follow:true},
  openGraph:{type:'website',siteName:'Pheelm',title:list.title,description,url,images},
  twitter:{card:'summary_large_image',title:list.title,description,images},
 };
}
