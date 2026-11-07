import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilmGrid } from "@/components/FilmCard";
import CommunityTile from "@/components/CommunityTile";
import Icon, { type IconName } from "@/components/Icon";
import FilmActionBar from "@/components/FilmActionBar";
import PeopleGrid from "@/components/PeopleGrid";
import Poster from "@/components/Poster";
import ShareButton from "@/components/ShareButton";
import TrailerButton from "@/components/TrailerButton";
import WatchSection from "@/components/WatchSection";
import WatchlistButton from "@/components/WatchlistButton";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilm, getFilms, toCard } from "@/lib/data";
import { personInfo, roleLabel, sentence } from "@/lib/roles";
import { countryName, inkFor, listJoin, runtimeLabel, trailerEmbed } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import type { Award, Credit, Role } from "@/lib/types";

export const revalidate = 300;
export const dynamicParams = true;

/**
 * Only the featured films are built ahead of time. Every other film page is built the first time
 * someone opens it and then kept (and refreshed every five minutes), so the build stays small and
 * quick however many films there are.
 */
export async function generateStaticParams() {
  return (await getFilms()).filter((f) => f.featured).slice(0, 40).map((f) => ({ slug: f.slug }));
}

type Params = { params: Promise<{ slug: string }> };

const validColour = (hex: string | null | undefined) => (hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null);

/** Tints the phone's browser bar with the film's colour, like Covvvvvers cover pages. */
export async function generateViewport({ params }: Params): Promise<Viewport> {
  const film = await getFilm((await params).slug);
  const bg = validColour(film?.color);
  return bg ? { themeColor: bg } : {};
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const film = await getFilm((await params).slug);
  if (!film) return {};
  const by = listJoin(film.directors.map((d) => d.name));
  return {
    title: `${film.title} (${film.year}), directed by ${by}`,
    description: film.synopsis ?? `${film.title}, directed by ${by}.`,
    alternates: { canonical: `/films/${film.slug}` },
  };
}

// Crew in the order people look for them.
const CREW_ORDER: Role[] = ["director", "writer", "cinematographer", "editor", "composer", "producer"];
// How many cast members show before "Show all".
const CAST_SHOWN = 6;

/**
 * The whole page takes the film's colour (from its poster), with black or white text for
 * contrast. Films without a poster colour keep the site's own black, white and gray.
 */
function pageColours(bg: string) {
  const ink = inkFor(bg);
  const mix = (n: number) => `color-mix(in srgb, ${ink} ${n}%, ${bg})`;
  return `:root[data-theme]{--bg:${bg};--ink:${ink};--text:${ink};--on-ink:${bg};--muted:${mix(66)};--line:${mix(18)};--line-strong:${mix(32)};--surface:${mix(5)};--raised:${mix(9)};--hover:${mix(12)};--gold:${ink};color-scheme:${ink === "#ffffff" ? "dark" : "light"}}`;
}

export default async function FilmPage({ params }: Params) {
  const film = await getFilm((await params).slug);
  if (!film) notFound();

  const [all, allDirectors, community] = await Promise.all([getFilms(), getDirectors(), getCommunityCollections({ filmId: film.id })]);
  const anyDirector = new Set(allDirectors.map((d) => d.id));
  // Films that share a collection with this one.
  const companions = new Set(community.flatMap((c) => c.films.map((f) => f.id)));
  const directorIds = new Set(film.directors.map((d) => d.id));
  const moreByDirector = all.filter((f) => f.id !== film.id && f.directors.some((d) => directorIds.has(d.id)));
  // More like this: films that share the most with this one. Being in a collection together counts most,
  // then each shared genre and country, then the same decade; closer years break ties.
  const decade = Math.floor(film.year / 10);
  const related = all
    .filter((f) => f.id !== film.id && !moreByDirector.includes(f))
    .map((f) => ({
      f,
      score:
        (companions.has(f.id) ? 3 : 0) +
        f.genres.filter((g) => film.genres.includes(g)).length +
        f.countries.filter((c) => film.countries.includes(c)).length +
        (Math.floor(f.year / 10) === decade ? 1 : 0),
    }))
    .filter((r) => r.score > 1)
    .sort((a, b) => b.score - a.score || Math.abs(a.f.year - film.year) - Math.abs(b.f.year - film.year))
    .slice(0, 12)
    .map((r) => r.f);

  const bg = validColour(film.color);
  const cast = film.credits.filter((c) => c.role === "cast");
  const crew = CREW_ORDER
    .map((role) => ({ role, people: film.credits.filter((c) => c.role === role) }))
    .filter((g) => g.people.length);
  const wins = film.awards.filter((a) => a.result === "won").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const noms = film.awards.filter((a) => a.result === "nominated").sort((a, b) => prestige(a.award) - prestige(b.award) || a.year - b.year);
  const embed = trailerEmbed(film.trailer_url);
  const directorNames = film.directors.map((d) => d.name);

  const runtime = runtimeLabel(film.runtime);
  const aka = (film.aka ?? []).filter((t) => t && t !== film.title && t !== film.original_title);

  // Everyone once, with all they did: crew in the usual order, then the cast by billing.
  // Someone who directed and acted reads "Director and actor".
  const counts = new Map<Role, number>();
  for (const c of film.credits) counts.set(c.role, (counts.get(c.role) ?? 0) + 1);
  const byPerson = new Map<string, { person: Credit["person"]; roles: string[] }>();
  for (const c of [...crew.flatMap((g) => g.people), ...cast]) {
    const entry = byPerson.get(c.person.id) ?? { person: c.person, roles: [] };
    const label = roleLabel(c, counts.get(c.role) ?? 1);
    if (!entry.roles.includes(label)) entry.roles.push(label);
    byPerson.set(c.person.id, entry);
  }
  const people = [...byPerson.values()].map((p) => ({ info: personInfo(p.person, all, anyDirector), role: sentence(p.roles) }));
  // The crew and the first six of the cast show; the rest sit behind "Show all".
  const crewCount = new Set(crew.flatMap((g) => g.people.map((c) => c.person.id))).size;
  const shown = Math.min(people.length, crewCount + CAST_SHOWN);
  const details: [string, React.ReactNode][] = [
    ...(film.original_title && film.original_title !== film.title ? ([["Original title", film.original_title]] as [string, React.ReactNode][]) : []),
    ...(aka.length ? ([["Also known as", aka.join(", ")]] as [string, React.ReactNode][]) : []),
    [film.countries.length > 1 ? "Countries" : "Country", film.countries.length ? film.countries.map((c, i) => (
      <span key={c}>{i > 0 && ", "}<Link href={`/films?country=${c}`}>{countryName(c)}</Link></span>
    )) : null],
    [film.languages.length > 1 ? "Languages" : "Language", film.languages.length ? film.languages.join(", ") : null],
    ["Genre", film.genres.length ? film.genres.map((g, i) => (
      <span key={g}>{i > 0 && ", "}<Link href={`/films?genre=${encodeURIComponent(g)}`}>{g}</Link></span>
    )) : null],
    ["Running time", runtime],
    ["Released", <Link key="y" href={`/films?decade=${Math.floor(film.year / 10) * 10}s`}>{film.year}</Link>],
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    url: `${SITE_URL}/films/${film.slug}`,
    datePublished: String(film.year),
    director: film.directors.map((d) => ({ "@type": "Person", name: d.name })),
    actor: cast.slice(0, 10).map((c) => ({ "@type": "Person", name: c.person.name })),
    image: film.poster_url ?? undefined,
    description: film.synopsis ?? undefined,
    countryOfOrigin: film.countries.map((c) => ({ "@type": "Country", name: countryName(c) })),
    inLanguage: film.languages,
  };

  return (
    <>
      <article className="film-page">
        {/* Hands the film's colour to the whole page, header and footer included, while it's open. */}
        {bg && <style>{pageColours(bg)}</style>}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

        <div className="film-art">
          <Poster title={film.title} year={film.year} directors={directorNames} src={film.poster_url} sizes="(min-width: 800px) 46vw, 100vw" priority hero />
        </div>

        <div className="film-body">
          {/* 1. Overview: what it is, and the three things you can do. */}
          <section className="film-overview" aria-labelledby="film-title">
            <header className="film-head">
              <h1 className="film-title" id="film-title">{film.title}</h1>
              <p className="film-byline">
                <span className="byline-item">
                  {film.directors.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && (i === film.directors.length - 1 ? " and " : ", ")}
                      <Link href={`/directors/${d.slug}`}>{d.name}</Link>
                    </span>
                  ))}
                </span>
                <Link className="byline-item" href={`/films?decade=${Math.floor(film.year / 10) * 10}s`}>{film.year}</Link>
                {runtime && <span className="byline-item">{runtime}</span>}
              </p>
            </header>

            <div className="film-actions">
              {embed ? (
                <TrailerButton embed={embed} title={film.title} className="pill-button" label="Trailer" action="trailer" />
              ) : (
                // No trailer on file yet: search YouTube for it instead.
                <a
                  className="pill-button"
                  data-action="trailer"
                  href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${film.title} ${film.year} trailer`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="play" className="solid" />
                  Trailer
                </a>
              )}
              <WatchlistButton filmId={film.id} filmTitle={film.title} />
              <ShareButton title={film.title} />
            </div>

            {film.note && <p className="film-note">{film.note}</p>}

            {film.synopsis && (
              <div className="film-essay">
                {film.synopsis.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}
          </section>

          {/* 2. About: small facts to scan. */}
          <section className="film-section" aria-labelledby="details-h">
            <h2 id="details-h">About</h2>
            <dl className="details">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt><Icon name={DETAIL_ICONS[k] ?? "film"} />{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          {/* 3. Awards: wins first, nominations folded away. Left out when there are none. */}
          {(wins.length > 0 || noms.length > 0) && (
            <section className="film-section" aria-labelledby="awards-h">
              <h2 id="awards-h">Awards</h2>
              {wins.length > 0 && <AwardList awards={wins} />}
              {noms.length > 0 && (wins.length > 0 ? (
                <details className="more">
                  <summary className="button ghost small">
                    <span className="more-closed">Show {noms.length} {noms.length === 1 ? "nomination" : "nominations"}</span>
                    <span className="more-open">Hide nominations</span>
                  </summary>
                  <AwardList awards={noms} />
                </details>
              ) : <AwardList awards={noms} />)}
            </section>
          )}

          {/* 4. Cast and crew: who made it, each with what they did. */}
          {people.length > 0 && (
            <section className="film-section" aria-labelledby="people-h">
              <h2 id="people-h">Cast and crew</h2>
              <PeopleGrid people={people.slice(0, shown)} />
              {people.length > shown && (
                <details className="more">
                  <summary className="button ghost small">
                    <span className="more-closed">Show all {people.length}</span>
                    <span className="more-open">Show fewer</span>
                  </summary>
                  <PeopleGrid people={people.slice(shown)} />
                </details>
              )}
            </section>
          )}

          {/* 5. Where to watch. */}
          <section className="film-section" aria-labelledby="watch-h">
            <h2 id="watch-h">Where to watch</h2>
            <WatchSection watch={film.watch} title={film.title} />
          </section>

        </div>
      </article>

      {/* 6. Keep exploring. */}
      {community.length > 0 && (
        <section className="related" aria-labelledby="in-collections-h">
          <div className="section-head">
            <h2 id="in-collections-h">Featured in</h2>
            {community.length > 6 && (
              <Link className="button ghost small" href={`/collections?film=${film.slug}`}>All {community.length}</Link>
            )}
          </div>
          <ul className="collection-list">
            {community.slice(0, 6).map((c) => <CommunityTile key={c.id} c={c} />)}
          </ul>
        </section>
      )}
      {moreByDirector.length > 0 && (
        <section className="related" aria-labelledby="more-h">
          <div className="section-head">
            <h2 id="more-h">More from {listJoin(directorNames)}</h2>
          </div>
          <FilmGrid films={moreByDirector.map(toCard)} />
        </section>
      )}
      {related.length > 0 && (
        <section className="related" aria-labelledby="related-h">
          <div className="section-head">
            <h2 id="related-h">More like this</h2>
          </div>
          <FilmGrid films={related.map(toCard)} />
        </section>
      )}

      <FilmActionBar title={film.title} />
    </>
  );
}

const DETAIL_ICONS: Record<string, IconName> = {
  "Original title": "film", "Also known as": "film", Country: "globe", Countries: "globe", Language: "language", Languages: "language",
  Genre: "sparkle", "Running time": "clock", Released: "calendar",
};

function AwardList({ awards }: { awards: Award[] }) {
  return (
    <ul className="award-list">
      {awards.map((a, i) => (
        <li key={i}>
          <span className={`award-badge ${isRegistry(a) ? "kept" : a.result}`}>
            {a.result === "won" && !isRegistry(a) && <Icon name="laurel" />}
            {isRegistry(a) ? "Preserved" : a.result === "won" ? "Won" : "Nominated"}
          </span>
          <span className="award-text">
            <span className="award-name">{a.award}</span>
            <span className="award-what">{isRegistry(a) ? "Selected for the National Film Registry" : a.category}</span>
          </span>
          <span className="award-year">{a.year}</span>
        </li>
      ))}
    </ul>
  );
}

// The festivals and awards people recognise first lead the summary line.
const ORDER = ["Academy Awards", "Cannes Film Festival", "Berlin International Film Festival", "Venice Film Festival", "BAFTA Awards", "César Awards", "Golden Globe Awards", "FESPACO", "Sundance Film Festival"];
function prestige(award: string) {
  const i = ORDER.indexOf(award);
  return i === -1 ? (award === "National Film Registry" ? 99 : 50) : i;
}
const isRegistry = (a: Award) => a.award === "National Film Registry";
