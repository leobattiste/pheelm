import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getDirector, getPerson } from "@/lib/data";
import { countryName, ROLE_LABELS } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPerson((await params).slug);
  return p ? { title: p.person.name } : {};
}

/** Cast and crew pages. Directors have their own, fuller page. */
export default async function PersonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (await getDirector(slug)) redirect(`/directors/${slug}`);
  const found = await getPerson(slug);
  if (!found) notFound();
  const { person, work } = found;

  return (
    <article className="page">
      <header className="person-head">
        {person.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="portrait" src={person.photo_url} alt="" />
        )}
        <div className="person-text">
          <h1>{person.name}</h1>
          {person.country && <dl className="person-facts"><div><dt>From</dt><dd>{countryName(person.country)}</dd></div></dl>}
          {person.bio && <p className="bio">{person.bio}</p>}
        </div>
      </header>
      <section className="section">
        <h2>In the directory</h2>
        <ol className="filmography">
          {work.sort((a, b) => b.film.year - a.film.year).map((w) => (
            <li key={w.film.id + w.role}>
              <span className="year">{w.film.year}</span>
              <Link href={`/films/${w.film.slug}`}>{w.film.title}</Link>
              <span className="muted">
                {w.role === "cast" ? "Actor" : ROLE_LABELS[w.role]}, directed by {w.film.directors.map((d) => d.name).join(" and ")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
