import {sitemapEntries,SITEMAP_CHUNK,xmlEscape} from '@/lib/seo-sitemap';
import {SITE_URL} from '@/lib/supabase/config';
export const revalidate=3600;
export const dynamic='force-static';
export async function GET(){
 const catalog=await sitemapEntries();
 const paths=Object.entries(catalog).flatMap(([kind,entries])=>Array.from({length:Math.ceil(entries.length/SITEMAP_CHUNK)},(_,i)=>`${SITE_URL}/sitemaps/${kind}-${i+1}.xml`));
 return new Response('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+paths.map(path=>'<sitemap><loc>'+xmlEscape(path)+'</loc></sitemap>').join('')+'</sitemapindex>',{headers:{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=0, s-maxage=3600'}});
}
