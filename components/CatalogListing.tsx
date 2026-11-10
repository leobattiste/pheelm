import Link from 'next/link';
import {FilmGrid} from './FilmCard';
import DirectorCard from './DirectorCard';
import {toCard,toDirectorSummary} from '@/lib/data';
import type {Film,Director} from '@/lib/types';
export const CATALOG_PAGE_SIZE=24;
export function catalogPagePath(mode:'films'|'directors',page:number){return page===1?`/${mode}`:`/${mode}/page/${page}`;}
/** Plain HTML links and cards remain usable without JavaScript. Interactive browsing replaces this on the index. */
export default function CatalogListing({mode,films=[],directors=[],page=1}:{mode:'films'|'directors';films?:Film[];directors?:Director[];page?:number}){
 const sorted=mode==='films'?[...films].sort((a,b)=>a.title.localeCompare(b.title)||a.id.localeCompare(b.id)):[...directors].sort((a,b)=>a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const total=Math.ceil(sorted.length/CATALOG_PAGE_SIZE),start=(page-1)*CATALOG_PAGE_SIZE;
 return <div className="catalog-html-listing">
  {mode==='films'?<FilmGrid films={(sorted as Film[]).slice(start,start+CATALOG_PAGE_SIZE).map(toCard)}/>:<ul className="director-grid">{(sorted as Director[]).slice(start,start+CATALOG_PAGE_SIZE).map(d=><DirectorCard key={d.id} director={toDirectorSummary(d)}/>)}</ul>}
  {total>1&&<nav className="catalog-page-navigation" aria-label={`${mode==='films'?'Films':'Directors'} pages`}>
   {page>1&&<Link className="button ghost" href={catalogPagePath(mode,page-1)}>Previous page</Link>}
   <span className="muted">Page {page} of {total}</span>
   {page<total&&<Link className="button ghost" href={catalogPagePath(mode,page+1)}>Next page</Link>}
  </nav>}
 </div>;
}
