import { pageMetadata, privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Portrait } from "@/components/DirectorCard";
import FollowButton from "@/components/FollowButton";
import Breadcrumbs from "@/components/Breadcrumbs";
import FeedbackLink from "@/components/FeedbackLink";
import MoreMenu from "@/components/MoreMenu";
import ShareButton from "@/components/ShareButton";
import { PersonLinks } from "@/components/PersonDetails";
import { FilmGrid } from "@/components/FilmCard";
import Tabs from "@/components/Tabs";
import { getDirector, getFilms, toCard } from "@/lib/data";
import { countryName } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import { bornText, diedText, rolesOnFilm, rolesWithCommas, worksOf } from "@/lib/roles";

export const revalidate = 3600; // admin saves refresh it right away
export const dynamicParams = true;

// Director pages are built the first time someone opens one, then kept, so the build stays small.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await getDirector((await params).slug);
  if (!d) return privateMetadata("Director not found");
  return pageMetadata(`${d.name}, director`,d.bio||`Films directed by ${d.name}, with where to watch them, on Pheelm.`,`/directors/${d.slug}`,`/directors/${d.slug}/opengraph-image`,'profile');
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

  // Every award their films won, newest first (the National Film Registry is a preservation, not an award).
  const awards = director.films
    .flatMap((f) => f.awards.filter((a) => a.result === "won" && a.award !== "National Film Registry").map((a) => ({ ...a, film: f.title, slug: f.slug, filmYear: f.year })))
    .sort((a, b) => b.year - a.year || a.award.localeCompare(b.award));
  const born = bornText({ born: director.born ?? null, birth_year: director.birth_year ?? null, birthplace: director.birthplace ?? null });
  const died = diedText({ died: director.died ?? null });
  const bio = director.bio?.split(/\n{2,}/).filter(Boolean) ?? [];

  const tabs = [
    {
      id: "filmography",
      label: "Filmography",
      icon: "clapper" as const,
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
            {awards.length > 0 && (
              <div className="details-wide">
                <dt>Awards</dt>
                <dd>
                  <ul className="about-awards">
                    {awards.map((a, i) => (
                      <li key={i}>
                        <span className="award-name">{a.award}</span>, {a.category}, {a.year}
                        <span className="muted"> for <Link href={`/films/${a.slug}`}>{a.film}</Link></span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
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
      <Breadcrumbs parent="Directors" href="/directors" current={director.name} currentHref={`/directors/${director.slug}`} />
      <header className="person-head">
        <MoreMenu corner label={`Actions for ${director.name}`}>
          <FollowButton personId={director.id} name={director.name} />
          <ShareButton item title={`${director.name} on Pheelm`} />
          <FeedbackLink about={`/directors/${director.slug}`} label={director.name} />
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
