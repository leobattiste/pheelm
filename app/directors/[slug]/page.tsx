import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/DirectorCard";
import { FilmGrid } from "@/components/FilmCard";
import FollowButton from "@/components/FollowButton";
import GridToggle from "@/components/GridToggle";
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
  const first = Math.min(...years);
  const last = Math.max(...years);
  const wins = director.films.reduce((n, f) => n + f.awards.filter((a) => a.result === "won" && a.award !== "National Film Registry").length, 0);

  return (
    <article className="page">
      <header className="person-head">
        <Portrait director={director} />
        <div className="person-text">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/directors">Directors</Link></nav>
          <h1>{director.name}</h1>
          <div className="film-actions person-actions">
            <FollowButton personId={director.id} name={director.name} />
          </div>
          <dl className="person-facts">
            {director.country && <div><dt>From</dt><dd>{countryName(director.country)}</dd></div>}
            {director.birth_year && <div><dt>Born</dt><dd>{director.birth_year}</dd></div>}
            <div><dt>In the directory</dt><dd>{director.films.length} {director.films.length === 1 ? "film" : "films"}, {first === last ? first : `${first} to ${last}`}</dd></div>
            {wins > 0 && <div><dt>Major prizes</dt><dd>{wins}</dd></div>}
          </dl>
          {director.bio && <p className="bio">{director.bio}</p>}
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>Films</h2>
          <GridToggle />
        </div>
        <FilmGrid films={director.films.map(toCard)} priority={6} />
      </section>

      {director.films.length > 2 && (
        <section className="section">
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
      )}

      {other.length > 0 && (
        <section className="section">
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
