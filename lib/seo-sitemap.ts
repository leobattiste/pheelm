import {getFilms,getDirectors} from './data';
import {getPublicProfileHandles} from './community';
import {getPublicWatchlists} from './watchlists';
import {watchlistPath} from './watchlist-links';
import {PUBLIC_PAGES} from './seo';
import {SITE_URL} from './supabase/config';
export const SITEMAP_CHUNK=1000;
export type SitemapEntry={path:string;lastModified?:string};
export async function sitemapEntries():Promise<Record<string,SitemapEntry[]>>{
 const [films,directors,profiles,watchlists]=await Promise.all([getFilms(),getDirectors(),getPublicProfileHandles(),getPublicWatchlists()]);
 const directorIds=new Set(directors.map(d=>d.id));
 const people=new Map(films.flatMap(f=>f.credits.filter(c=>!directorIds.has(c.person.id)).map(c=>[c.person.slug,{path:`/people/${c.person.slug}`}] as const)));
 const pages=Object.keys(PUBLIC_PAGES).map(path=>({path}));
 for(const [mode,count]of [['films',films.length],['directors',directors.length]]as const)for(let page=2;page<=Math.ceil(count/24);page++)pages.push({path:`/${mode}/page/${page}`});
 return {pages,films:films.map(f=>({path:`/films/${f.slug}`})),directors:directors.map(d=>({path:`/directors/${d.slug}`})),people:[...people.values()],profiles:profiles.map(handle=>({path:`/@${handle}`})),watchlists:watchlists.map(w=>({path:watchlistPath(w),lastModified:w.updated_at}))};
}
export function xmlEscape(value:string){return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
export function sitemapXml(entries:SitemapEntry[]){
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+entries.map(entry=>'<url><loc>'+xmlEscape(SITE_URL+entry.path)+'</loc>'+(entry.lastModified?'<lastmod>'+xmlEscape(entry.lastModified)+'</lastmod>':'')+'</url>').join('')+'</urlset>';
}
