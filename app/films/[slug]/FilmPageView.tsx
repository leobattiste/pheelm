import AwardsDialog from "@/components/AwardsDialog";
import { pageMetadata, privateMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FilmCard from "@/components/FilmCard";
import CommunityTile from "@/components/CommunityTile";
import Icon from "@/components/Icon";
import FilmActionBar from "@/components/FilmActionBar";
import FilmEditorial from "@/components/FilmEditorial";
import PeopleGrid from "@/components/PeopleGrid";
import Poster from "@/components/Poster";
import Breadcrumbs from "@/components/Breadcrumbs";
import FilmMenu from "@/components/FilmMenu";
import TrailerButton from "@/components/TrailerButton";
import WatchSection from "@/components/WatchSection";
import WatchlistButton from "@/components/WatchlistButton";
import FilmComments from "@/components/FilmComments";
import { getWatchlistTiles } from "@/lib/community";
import { filmPageCatalog, toCard } from "@/lib/data";
import { personInfo, roleLabel, sentence } from "@/lib/roles";
import { countryName, listJoin, runtimeLabel, trailerEmbed } from "@/lib/format";
import { SITE_URL } from "@/lib/supabase/config";
import type { Award, Credit, Role } from "@/lib/types";
import Row from "@/components/Row";
import { filmPath } from "@/lib/film-links";


export type Params = { params: Promise<{ slug: string }> };


export async function filmMetadata({ params }: Params): Promise<Metadata> {
  const { film } = await filmPageCatalog((await params).slug);
  if (!film) return privateMetadata("Film not found");
  const by = listJoin(film.directors.map((d) => d.name));
  return pageMetadata(`${film.title} (${film.year})`,film.synopsis||`${film.title}, directed by ${by}.`,filmPath(film.slug, film.directors),`/films/${film.slug}/opengraph-image`);
}

// Crew in the order people look for them.
const CREW_ORDER: Role[] = ["director", "writer", "cinematographer", "editor", "composer", "producer"];
// How many cast members show before "Show all".
const CAST_SHOWN = 6;

export async function FilmPageView({ params }: Params) {
  const { film, films: all, directors: allDirectors } = await filmPageCatalog((await params).slug);
  if (!film) notFound();

  const tiles = await getWatchlistTiles();
  const community = tiles.filter((t) => t.filmSlugs.includes(film.slug));
  const anyDirector = new Set(allDirectors.map((d) => d.id));
  // Films that share a watchlist with this one.
  const companions = new Set(community.flatMap((c) => c.filmSlugs));
  const directorIds = new Set(film.directors.map((d) => d.id));
  const moreByDirector = all.filter((f) => f.id !== film.id && f.directors.some((d) => directorIds.has(d.id)));
  // More like this: films in the same genre. The more genres they share the better, then being in a
  // collection together, the same country and the same decade; closer years break ties.
  const decade = Math.floor(film.year / 10);
  const related = all
    .filter((f) => f.id !== film.id && !moreByDirector.includes(f) && f.genres.some((g) => film.genres.includes(g)))
    .map((f) => ({
      f,
      score:
        f.genres.filter((g) => film.genres.includes(g)).length * 2 +
        (companions.has(f.slug) ? 2 : 0) +
        f.countries.filter((c) => film.countries.includes(c)).length +
        (Math.floor(f.year / 10) === decade ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || Math.abs(a.f.year - film.year) - Math.abs(b.f.year - film.year))
    .slice(0, 16)
    .map((r) => r.f);

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
  // The hero already says the year, running time and genres, so the facts beside the page don't repeat them.
  const details: [string, React.ReactNode][] = [
    [film.countries.length > 1 ? "Countries" : "Country", film.countries.length ? film.countries.map((c, i) => (
      <span key={c}>{i > 0 && ", "}<Link href={`/films?country=${c}`}>{countryName(c)}</Link></span>
    )) : null],
    [film.languages.length > 1 ? "Languages" : "Language", film.languages.length ? film.languages.join(", ") : null],
    ...(film.original_title && film.original_title !== film.title ? ([["Original title", film.original_title]] as [string, React.ReactNode][]) : []),
    ...(aka.length ? ([["Also known as", aka.join(", ")]] as [string, React.ReactNode][]) : []),
  ];
  const facts = details.filter(([, v]) => v);
  // The wide still runs behind the top of the page; without one, the poster, blurred, sets the mood.
  const still = film.backdrop_url ?? film.poster_url;
  const topAward = wins[0] ?? null;
  const decadeHref = `/films?decade=${Math.floor(film.year / 10) * 10}s`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: film.title,
    url: `${SITE_URL}${filmPath(film.slug, film.directors)}`,
    "@id": `${SITE_URL}${filmPath(film.slug, film.directors)}#film`,
    mainEntityOfPage: `${SITE_URL}${filmPath(film.slug, film.directors)}`,
    dateCreated: String(film.year),
    ...(film.runtime ? {duration:`PT${film.runtime}M`}:{}),
    director: film.directors.map((d) => ({ "@type": "Person", name: d.name, url:`${SITE_URL}/${anyDirector.has(d.id)?"directors":"people"}/${d.slug}` })),
    actor: cast.slice(0, 10).map((c) => ({ "@type": "Person", name: c.person.name })),
    image: film.poster_url ?? undefined,
    description: film.synopsis ?? undefined,
    countryOfOrigin: film.countries.map((c) => ({ "@type": "Country", name: countryName(c) })),
    inLanguage: film.languages,
  };

  return (
    <>
      <article className="film-page film-v2">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <Breadcrumbs parent="Films" href="/films" current={film.title} currentHref={filmPath(film.slug, film.directors)} />

        {/* 1. The hero: the film's still behind its poster, title, the facts at a glance and the three things you can do. */}
        <header className={`film-hero${still ? " has-still" : ""}${film.backdrop_url ? " is-backdrop" : " is-blurred"}`}>
          {still && (
            <div className="film-hero-bg" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={still} srcSet={stillSrcSet(still)} sizes="100vw" alt="" fetchPriority="high" decoding="async" />
            </div>
          )}
          <div className="film-hero-inner">
            <div className="film-art">
              <Poster title={film.title} year={film.year} directors={directorNames} src={film.poster_url} sizes="(min-width: 800px) 300px, 120px" priority hero />
            </div>

            <section className="film-overview" aria-labelledby="film-title">
              <div className="film-head">
                <h1 className="film-title" id="film-title">{film.title}</h1>
                <p className="film-byline">
                  <span className="byline-label">Directed by </span>
                  {film.directors.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 && (i === film.directors.length - 1 ? " and " : ", ")}
                      <Link href={d.in_directory === false ? `/people/${d.slug}` : `/directors/${d.slug}`}>{d.name}</Link>
                    </span>
                  ))}
                </p>
                <p className="film-meta">
                  <Link href={decadeHref}>{film.year}</Link>
                  {runtime && <span>{runtime}</span>}
                  {film.genres.slice(0, 3).map((g) => (
                    <Link key={g} className="film-genre" href={`/films?genre=${encodeURIComponent(g)}`}>{g}</Link>
                  ))}
                </p>
                {topAward && (
                  <a className="film-laurel" href="#awards-h">
                    <Icon name="laurel" />
                    <span>{isRegistry(topAward) ? "National Film Registry" : `${topAward.award}${topAward.category ? `, ${topAward.category}` : ""}`}</span>
                    {wins.length > 1 && <span className="film-laurel-more">+{wins.length - 1} more {wins.length - 1 === 1 ? "win" : "wins"}</span>}
                  </a>
                )}
              </div>

              <div className="film-actions">
                {embed ? (
                  <TrailerButton embed={embed} title={film.title} className="pill-button primary" label="Trailer" action="trailer" />
                ) : (
                  // No trailer on file yet: search YouTube for it instead. Same button either way —
                  // what differs is where it takes you, which the label on hover says.
                  <a
                    className="pill-button primary"
                    data-action="trailer"
                    aria-label="Find trailer on YouTube"
                    title="Find trailer on YouTube"
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent([film.title, film.year, ...directorNames, "trailer"].join(" "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="play" className="solid" />
                    Trailer
                  </a>
                )}
                <WatchlistButton filmId={film.id} filmTitle={film.title} />
                <FilmMenu filmId={film.id} slug={film.slug} title={film.title} />
              </div>
            </section>
          </div>
        </header>

        <div className="film-layout">
          {/* The facts: a short, labelled sheet beside the reading column on desktop, after the story on phones. */}
          {facts.length > 0 && (
            <aside className="film-facts" aria-labelledby="details-h">
              <h2 id="details-h">Details</h2>
              <dl>
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}

          <div className="film-body">
            {/* 2. The story first. */}
            {(film.note || film.synopsis) && (
              <section className="film-story" aria-label="Synopsis">
                {film.note && <p className="film-note">{film.note}</p>}
                {film.synopsis && (
                  <div className="film-essay">
                    {film.synopsis.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                  </div>
                )}
              </section>
            )}

            {/* 3. Where to watch: what most people come for, right under the story. */}
            <section className="film-section" aria-labelledby="watch-h">
              <h2 id="watch-h">Where to watch</h2>
              <WatchSection watch={film.watch} title={film.title} slug={film.slug} />
            </section>

            <FilmEditorial filmId={film.id} />

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

            {/* 5. Awards: the first two (wins first), then every win and nomination in a sheet. */}
            {(wins.length > 0 || noms.length > 0) && (
              <section className="film-section" aria-labelledby="awards-h">
                <h2 id="awards-h">Awards</h2>
                <AwardList awards={[...wins, ...noms].slice(0, 3)} />
                {wins.length + noms.length > 3 && (
                  <AwardsDialog total={wins.length + noms.length} title={`Awards for ${film.title}`}>
                    {wins.length > 0 && <><h3 className="awards-group">{wins.length} {wins.length === 1 ? "win" : "wins"}</h3><AwardList awards={wins} /></>}
                    {noms.length > 0 && <><h3 className="awards-group">{noms.length} {noms.length === 1 ? "nomination" : "nominations"}</h3><AwardList awards={noms} /></>}
                  </AwardsDialog>
                )}
              </section>
            )}

            {/* 6. What members thought. */}
            <FilmComments filmId={film.id} filmTitle={film.title} />
          </div>
        </div>
      </article>

      {/* 7. Keep exploring. */}
      {community.length > 0 && (
        <section className="related" aria-labelledby="in-collections-h">
          <div className="section-head">
            <h2 id="in-collections-h">Featured in</h2>
            {community.length > 6 && (
              <Link className="button ghost small" href={`/watchlists?film=${film.slug}`}>All {community.length}</Link>
            )}
          </div>
          <ul className="collection-list">
            {community.slice(0, 6).map((c) => <CommunityTile key={c.id} c={c} filmCount={c.filmCount} />)}
          </ul>
        </section>
      )}
      {moreByDirector.length > 0 && (
        <Row title={`More from ${listJoin(directorNames)}`}>
          {moreByDirector.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      )}
      {related.length > 0 && (
        <Row title="More like this">
          {related.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      )}

      <FilmActionBar title={film.title} />
    </>
  );
}

/** TMDB stills come in a few widths; phones fetch the smaller one. */
function stillSrcSet(url: string) {
  if (!url.includes("image.tmdb.org/t/p/")) return undefined;
  return ["w780", "w1280"].map((w) => `${url.replace(/\/t\/p\/[^/]+\//, `/t/p/${w}/`)} ${w.slice(1)}w`).join(", ");
}

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
