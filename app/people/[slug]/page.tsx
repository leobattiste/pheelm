import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import PersonDetails from "@/components/PersonDetails";
import { getDirector, getDirectors, getFilms, getPerson } from "@/lib/data";
import { personInfo } from "@/lib/roles";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPerson((await params).slug);
  return p ? { title: p.person.name, description: p.person.bio?.split(/\n{2,}/)[0] } : {};
}

/**
 * Cast and crew. On film pages they open in a sheet; this page is the same details at their own
 * address, for search results and shared links. Directors have their own, fuller page.
 */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (await getDirector(slug)) redirect(`/directors/${slug}`);
  const found = await getPerson(slug);
  if (!found) notFound();
  const [films, directors] = await Promise.all([getFilms(), getDirectors()]);
  const info = personInfo(found.person, films, new Set(directors.map((d) => d.id)));

  return (
    <article className="page narrow person-page">
      <PersonDetails info={info} headingLevel={1} />
    </article>
  );
}
