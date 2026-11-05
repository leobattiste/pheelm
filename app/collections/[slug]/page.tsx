import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import { getCollection, getCollections, toCard } from "@/lib/data";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getCollections()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await getCollection((await params).slug);
  return c ? { title: c.title, description: c.description ?? undefined } : {};
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const collection = await getCollection((await params).slug);
  if (!collection) notFound();
  const years = collection.films.map((f) => f.year);

  return (
    <section className="page">
      <header className="page-head">
        <nav className="crumbs" aria-label="Breadcrumb"><Link href="/collections">Collections</Link></nav>
        <h1>{collection.title}</h1>
        {collection.description && <p className="lead">{collection.description}</p>}
      </header>
      <div className="section-head">
        <p className="label">{collection.films.length} films{years.length > 0 && ` • ${Math.min(...years)} to ${Math.max(...years)}`}</p>
      </div>
      <FilmGrid films={collection.films.map(toCard)} priority={8} />
    </section>
  );
}
