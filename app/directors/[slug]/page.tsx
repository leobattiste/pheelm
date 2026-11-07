import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/DirectorCard";
import FollowButton from "@/components/FollowButton";
import MoreMenu from "@/components/MoreMenu";
import ShareButton from "@/components/ShareButton";
import { PersonLinks } from "@/components/PersonDetails";
import { FilmGrid } from "@/components/FilmCard";
import Tabs from "@/components/Tabs";
import { getDirector, getFilms, toCard } from "@/lib/data";
import { countryName } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import { bornText, diedText, rolesOnFilm, rolesWithCommas, worksOf } from "@/lib/roles";

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
 * A director's profile: who they are at the top, then tabs for their films (as posters, with
 * what they did on each) and their biography.
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
      id: "filmography",
      label: "Filmography",
      panel: <FilmGrid films={theirFilms.map(toCard)} notes={roles} />,
    },
    {
      id: "about",
      label: "About",
      panel: (
        <div className="profile-about">
          {bio.length ? bio.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">No biography yet.</p>}
          <dl className="details">
            <div><dt>Roles</dt><dd>{rolesWithCommas(works) || "Director"}</dd></div>
            {born && <div><dt>Born</dt><dd>{born}</dd></div>}
            {died && <div><dt>Died</dt><dd>{died}</dd></div>}
            <div><dt>Films on Pheelm</dt><dd>{first === last ? first : `${first} to ${last}`}</dd></div>
            {wins > 0 && <div><dt>Major prizes</dt><dd>{wins}</dd></div>}
            <PersonLinks info={{ name: director.name, imdb_id: director.imdb_id ?? null, instagram: director.instagram ?? null }} />
          </dl>
        </div>
      ),
    },
  ];

  // For search engines: the director as a Person, with the films they directed.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: director.name,
    url: `${SITE_URL}/directors/${director.slug}`,
    jobTitle: "Film director",
    ...(director.photo_url ? { image: director.photo_url } : {}),
    ...(director.bio ? { description: director.bio.split(/\n{2,}/)[0] } : {}),
    ...(director.born ? { birthDate: director.born } : {}),
    ...(director.died ? { deathDate: director.died } : {}),
    ...(director.birthplace ? { birthPlace: director.birthplace } : {}),
    ...(director.country ? { nationality: { "@type": "Country", name: countryName(director.country) } } : {}),
    sameAs: [
      director.imdb_id && `https://www.imdb.com/name/${director.imdb_id}/`,
      director.instagram && `https://www.instagram.com/${director.instagram}/`,
    ].filter(Boolean),
    subjectOf: director.films.map((f) => ({ "@type": "Movie", name: f.title, dateCreated: String(f.year), url: `${SITE_URL}/films/${f.slug}` })),
  };

  return (
    <article className="page profile">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="person-head">
        <MoreMenu corner label={`Actions for ${director.name}`}>
          <FollowButton personId={director.id} name={director.name} />
          <ShareButton item title={`${director.name} on Pheelm`} />
        </MoreMenu>
        <Portrait director={director} />
        <div className="person-text">
          <h1>{director.name}</h1>
          {director.country && <p className="person-roles">{countryName(director.country)}</p>}
        </div>
      </header>
      <Tabs tabs={tabs} />
    </article>
  );
}
