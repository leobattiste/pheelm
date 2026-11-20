import { pageMetadata, privateMetadata, seoText } from "@/lib/seo";
import { SITE_URL } from "@/lib/supabase/config";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PersonDetails from "@/components/PersonDetails";
import { getDirector, getDirectors, getFilms, getPerson } from "@/lib/data";
import { personInfo } from "@/lib/roles";

export const revalidate = 3600; // admin saves refresh it right away

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug=(await params).slug;
  const [p,d]=await Promise.all([getPerson(slug),getDirector(slug)]);
  if(!p)return privateMetadata('Person not found');
  const path=d?`/directors/${slug}`:`/people/${slug}`;
  return pageMetadata(p.person.name,p.person.bio||`Explore films featuring ${p.person.name} and their work in Black cinema on Pheelm.`,path,path+'/opengraph-image','profile');
}

/**
 * Cast and crew. On film pages they open in a sheet; this page is the same details at their own
 * address, for search results and shared links. Directors have their own, fuller page.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (await getDirector(slug)) permanentRedirect(`/directors/${slug}`);
  const found = await getPerson(slug);
  if (!found) notFound();
  const [films, directors] = await Promise.all([getFilms(), getDirectors()]);
  const info = personInfo(found.person, films, new Set(directors.map((d) => d.id)));

  return (
    <article className="page narrow person-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@type':'Person',name:found.person.name,url:`${SITE_URL}/people/${slug}`,...(found.person.bio?{description:seoText(found.person.bio,600)}:{}),...(found.person.photo_url?{image:found.person.photo_url}:{}),subjectOf:[...new Map(found.work.map(w=>[w.film.id,{'@type':'Movie',name:w.film.title,url:`${SITE_URL}/films/${w.film.slug}`}])).values()]}).replace(/</g,'\\u003c')}}/>
      <PersonDetails info={info} headingLevel={1} />
    </article>
  );
}
