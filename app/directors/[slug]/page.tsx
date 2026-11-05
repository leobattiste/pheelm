import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/DirectorCard";
import FollowButton from "@/components/FollowButton";
import { PersonLinks } from "@/components/PersonDetails";
import { FilmGrid } from "@/components/FilmCard";
import Tabs from "@/components/Tabs";
import { getDirector, getFilms, toCard } from "@/lib/data";
import { countryName } from "@/lib/format";
import { bornText, diedText, overallRoles, rolesOnFilm, sentence, worksOf } from "@/lib/roles";

export const revalidate = 300;
export const dynamicParams = true;

// Director pages are built the first time someone opens one, then kept, so the build stays small.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await getDirector((await params).slug);
  if (!d) return {};
  return { title: d.name, description: d.bio?.split(/\n{2,}/)[0] ?? `Films directed by ${d.name}.` };
}

/**
 * A director's profile: who they are at the top, then tabs for their films, their biography
 * and their filmography.
 */
export default async function DirectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const director = await getDirector(slug);
  if (!director) notFound();
  const all = await getFilms();

  // Every film they worked on here, directed or not, with what they did on each.
  const works = worksOf(director.id, all);
  const theirFilms = all.filter((f) => works.some((w) => w.slug === f.slug)).sort((a, b) => b.year - a.year);
  const roles = Object.fromEntries(theirFilms.map((f) => [f.id, rolesOnFilm(f, director.id)]));

  const years = director.films.map((f) => f.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const wins = director.films.reduce((n, f) => n + f.awards.filter((a) => a.result === "won" && a.award !== "National Film Registry").length, 0);
  const born = bornText({ born: director.born ?? null, birth_year: director.birth_year ?? null, birthplace: director.birthplace ?? null });
  const died = diedText({ died: director.died ?? null });
  const bio = director.bio?.split(/\n{2,}/).filter(Boolean) ?? [];

  const tabs = [
    {
      id: "films",
      label: "Films",
      panel: <FilmGrid films={theirFilms.map(toCard)} notes={roles} />,
    },
    {
      id: "about",
      label: "About",
      panel: (
        <div className="profile-about">
          {bio.length ? bio.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No biography yet.</p>}
          <dl className="details">
            {director.country && <div><dt>From</dt><dd>{countryName(director.country)}</dd></div>}
            {born && <div><dt>Born</dt><dd>{born}</dd></div>}
            {died && <div><dt>Died</dt><dd>{died}</dd></div>}
            <div><dt>On Pheelm</dt><dd>{director.films.length} {director.films.length === 1 ? "film" : "films"} directed, {first === last ? first : `${first} to ${last}`}</dd></div>
            {wins > 0 && <div><dt>Major prizes</dt><dd>{wins}</dd></div>}
          </dl>
          <PersonLinks info={{ name: director.name, imdb_id: director.imdb_id ?? null, instagram: director.instagram ?? null }} />
        </div>
      ),
    },
    {
      id: "filmography",
      label: "Filmography",
      panel: (
        <ol className="filmography">
          {works.map((w) => (
            <li key={w.slug}>
              <span className="year">{w.year}</span>
              <Link href={`/films/${w.slug}`}>{w.title}</Link>
              <span className="muted">{w.role}</span>
            </li>
          ))}
        </ol>
      ),
    },
  ];

  return (
    <article className="page profile">
      <header className="person-head">
        <Portrait director={director} />
        <div className="person-text">
          <h1>{director.name}</h1>
          <p className="person-roles">{overallRoles(works) || sentence(["Director"])}</p>
          <div className="person-actions">
            <FollowButton personId={director.id} name={director.name} />
          </div>
        </div>
      </header>
      <Tabs tabs={tabs} />
    </article>
  );
}
