import {sitemapEntries,sitemapXml,SITEMAP_CHUNK} from '@/lib/seo-sitemap';
export const revalidate=3600;
export async function GET(_request:Request,{params}:{params:Promise<{file:string}>}){
 const match=/^(pages|films|directors|people|profiles|watchlists)-([1-9][0-9]{0,5})\.xml$/.exec((await params).file);
 if(!match)return new Response('Not found',{status:404});
 const catalog=await sitemapEntries(),from=(Number(match[2])-1)*SITEMAP_CHUNK;
 const entries=catalog[match[1]].slice(from,from+SITEMAP_CHUNK);
 if(!entries.length)return new Response('Not found',{status:404});
 return new Response(sitemapXml(entries),{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=0, s-maxage=3600'}});
}
