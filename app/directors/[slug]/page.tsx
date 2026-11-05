import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/DirectorCard";
import FollowButton from "@/components/FollowButton";
import PeopleGrid, { type PersonEntry } from "@/components/PeopleGrid";
import { PersonLinks } from "@/components/PersonDetails";
import PersonFilms from "@/components/PersonFilms";
import Tabs from "@/components/Tabs";
import { getDirector, getDirectors, getFilms, toCard } from "@/lib/data";
import { countryName } from "@/lib/format";
import { lifeLine, overallRoles, personInfo, rolesOnFilm, sentence, worksOf } from "@/lib/roles";

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await getDirectors()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await getDirector((await params).slug);
  if (!d) return {};
  return { title: d.name, description: d.bio?.split(/\n{2,}/)[0] ?? `Films directed by ${d.name}.` };
}

/**
 * A director's profile: who they are at the top, then tabs for their films, their biography,
 * their filmography and the people they work with most.
 */
export default async function DirectorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const director = await getDirector(slug);
  if (!director) notFound();
  const [all, directors] = await Promise.all([getFilms(), getDirectors()]);
  const directorIds = new Set(directors.map((d) => d.id));

  // Every film they worked on here, directed or not, with what they did on each.
  const works = worksOf(director.id, all);
  const theirFilms = all.filter((f) => works.some((w) => w.slug === f.slug)).sort((a, b) => b.year - a.year);
  const roles = Object.fromEntries(theirFilms.map((f) => [f.id, rolesOnFilm(f, director.id)]));

  const years = director.films.map((f) => f.year);
  const first = Math.min(...years);
  const last = Math.max(...years);
  const wins = director.films.reduce((n, f) => n + f.awards.filter((a) => a.result === "won" && a.award !== "National Film Registry").length, 0);
  const life = lifeLine({ born: director.born ?? null, died: director.died ?? null, birth_year: director.birth_year ?? null, birthplace: director.birthplace ?? null });
  const bio = director.bio?.split(/\n{2,}/).filter(Boolean) ?? [];

  // Worked with: the people who share the most films with them here.
  const shared = new Map<string, { person: (typeof all)[number]["credits"][number]["person"]; films: typeof all }>();
  for (const f of theirFilms) {
    for (const c of f.credits) {
      if (c.person.id === director.id) continue;
      const e = shared.get(c.person.id) ?? { person: c.person, films: [] };
      if (!e.films.includes(f)) e.films.push(f);
      shared.set(c.person.id, e);
    }
  }
  const collaborators: PersonEntry[] = [...shared.values()]
    .sort((a, b) => b.films.length - a.films.length || a.person.name.localeCompare(b.person.name))
    .slice(0, 12)
    .map(({ person, films }) => {
      const what = overallRoles(films.map((f) => ({ slug: f.slug, title: f.title, year: f.year, role: rolesOnFilm(f, person.id) })));
      return {
        info: personInfo(person, all, directorIds),
        role: films.length > 1 ? `${what} · ${films.length} films together` : what,
      };
    });

  const tabs = [
    {
      id: "films",
      label: "Films",
      panel: <PersonFilms films={theirFilms.map(toCard)} roles={roles} />,
    },
    {
      id: "about",
      label: "About",
      panel: (
        <div className="profile-about">
          {bio.length ? bio.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No biography yet.</p>}
          <dl className="details">
            {director.country && <div><dt>From</dt><dd>{countryName(director.country)}</dd></div>}
            {life && <div><dt>Life</dt><dd>{life}</dd></div>}
            <div><dt>On Pheelm</dt><dd>{director.films.length} {director.films.length === 1 ? "film" : "films"} directed, {first === last ? first : `${first} to ${last}`}</dd></div>
            {wins > 0 && <div><dt>Major prizes</dt><dd>{wins}</dd></div>}
          </dl>
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
    ...(collaborators.length
      ? [{ id: "worked-with", label: "Worked with", panel: <PeopleGrid people={collaborators} /> }]
      : []),
  ];

  return (
    <article className="page profile">
      <header className="person-head">
        <Portrait director={director} />
        <div className="person-text">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/directors">Directors</Link></nav>
          <h1>{director.name}</h1>
          <p className="person-roles">{overallRoles(works) || sentence(["Director"])}</p>
          {life && <p className="person-life">{life}</p>}
          <div className="person-actions">
            <FollowButton personId={director.id} name={director.name} />
            <PersonLinks info={{ name: director.name, imdb_id: director.imdb_id ?? null, instagram: director.instagram ?? null }} />
          </div>
        </div>
      </header>
      <Tabs tabs={tabs} />
    </article>
  );
}
