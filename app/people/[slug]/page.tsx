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
    <article className="page person">
      <header className="person-head">
        <div>
          <h1>{person.name}</h1>
          {person.country && <p className="film-facts"><span>{countryName(person.country)}</span></p>}
          {person.bio && <p className="bio">{person.bio}</p>}
        </div>
      </header>
      <section className="film-section">
        <h2>In the directory</h2>
        <ol className="filmography">
          {work.sort((a, b) => b.film.year - a.film.year).map((w) => (
            <li key={w.film.id + w.role}>
              <span className="year">{w.film.year}</span>
              <Link href={`/films/${w.film.slug}`}>{w.film.title}</Link>
              <span className="muted">
                {w.role === "cast" ? (w.character ? `as ${w.character}` : "Actor") : ROLE_LABELS[w.role]}
                {" · dir. "}
                {w.film.directors.map((d) => d.name).join(", ")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
