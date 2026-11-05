import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import { getDirector, getDirectors, getPerson, toCard } from "@/lib/data";
import { countryName, ROLE_LABELS, TYPE_LABELS } from "@/lib/format";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getDirectors()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await getDirector((await params).slug);
  if (!d) return {};
  return { title: d.name, description: d.bio ?? `Films directed by ${d.name}.` };
}

export default async function DirectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const director = await getDirector(slug);
  if (!director) notFound();
  const person = await getPerson(slug);
  // Other work: acting, writing or shooting films they didn't direct.
  const directed = new Set(director.films.map((f) => f.id));
  const other = (person?.work ?? []).filter((w) => !directed.has(w.film.id));
  const years = director.films.map((f) => f.year);
  const wins = director.films.reduce((n, f) => n + f.awards.filter((a) => a.result === "won").length, 0);

  return (
    <article className="page person">
      <header className="person-head">
        {director.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="portrait large" src={director.photo_url} alt={director.name} />
        ) : null}
        <div>
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/directors">Directors</Link>
          </nav>
          <h1>{director.name}</h1>
          <p className="film-facts">
            {director.country && <span>{countryName(director.country)}</span>}
            {director.birth_year && <span>Born {director.birth_year}</span>}
            <span>{director.films.length} {director.films.length === 1 ? "film" : "films"} in the directory</span>
            <span>Active {Math.min(...years)}{Math.max(...years) !== Math.min(...years) ? `–${Math.max(...years)}` : ""}</span>
            {wins > 0 && <span>{wins} major {wins === 1 ? "award" : "awards"}</span>}
          </p>
          {director.bio && <p className="bio">{director.bio}</p>}
        </div>
      </header>

      <section className="film-section wide">
        <h2>Films</h2>
        <FilmGrid films={director.films.map(toCard)} priority={6} />
      </section>

      <section className="film-section">
        <h2>Filmography</h2>
        <ol className="filmography">
          {director.films.map((f) => (
            <li key={f.id}>
              <span className="year">{f.year}</span>
              <Link href={`/films/${f.slug}`}>{f.title}</Link>
              <span className="muted">{TYPE_LABELS[f.type]}</span>
            </li>
          ))}
        </ol>
      </section>

      {other.length > 0 && (
        <section className="film-section">
          <h2>Other credits</h2>
          <ol className="filmography">
            {other.map((w) => (
              <li key={w.film.id + w.role}>
                <span className="year">{w.film.year}</span>
                <Link href={`/films/${w.film.slug}`}>{w.film.title}</Link>
                <span className="muted">{w.role === "cast" ? (w.character ? `as ${w.character}` : "Actor") : ROLE_LABELS[w.role]}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
