import {notFound,permanentRedirect} from 'next/navigation';
import Link from 'next/link';
import {getFilms} from '@/lib/data';
import {pageMetadata} from '@/lib/seo';
import CatalogListing,{CATALOG_PAGE_SIZE,catalogPagePath} from '@/components/CatalogListing';
export const revalidate=300;
export async function generateStaticParams(){return [];}
type Props={params:Promise<{page:string}>};
async function load(params:Props['params']){
 const value=(await params).page;if(!/^[1-9][0-9]{0,5}$/.test(value))notFound();
 const page=Number(value);if(page===1)permanentRedirect('/films');
 const items=await getFilms();if((page-1)*CATALOG_PAGE_SIZE>=items.length)notFound();
 return {page,items};
}
export async function generateMetadata({params}:Props){const {page}=await load(params);return pageMetadata('Films — Page '+page,'Browse more films in Pheelm’s directory of Black cinema around the world.',catalogPagePath('films',page),'/api/og?page=%2Ffilms');}
export default async function Page({params}:Props){const {page,items}=await load(params);return <section className="page"><header className="page-head"><p className="crumbs"><Link href="/films">Browse films with search and filters</Link></p><h1>Films — Page {page}</h1></header><CatalogListing mode="films" films={items} page={page}/></section>;}
