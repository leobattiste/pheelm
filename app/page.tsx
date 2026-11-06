import type { Metadata } from "next";
import Link from "next/link";
import DirectorCard from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import TrailerButton from "@/components/TrailerButton";
import FilmLink from "@/components/Transitions";
import { getArticles, getCollections, getDirectors, getFacets, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { trailerEmbed, tintStyle } from "@/lib/format";
import { PAGE_COPY } from "@/lib/site";
import { firstSentence } from "@/lib/text";

export const revalidate = 300;
export const metadata: Metadata = { description: PAGE_COPY.home };

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default async function Home() {
  const [films, directors, collections, facets, articles] = await Promise.all([
    getFilms(), getDirectors(), getCollections(), getFacets(), getArticles(),
  ]);

  // The film of the week rotates through the featured films, preferring ones with a still.
  const featured = films.filter((f) => f.featured);
  const withStill = featured.filter((f) => f.backdrop_url);
  const pool = withStill.length ? withStill : featured.length ? featured : films;
  const week = Math.floor(Date.now() / WEEK);
  const pick = pool[week % pool.length];
  const embed = trailerEmbed(pick.trailer_url);

  const startHere = featured.filter((f) => f.id !== pick.id);
  const recent = films.filter((f) => f.year >= 2015 && f.id !== pick.id).slice(0, 14);
  const shelves = collections.filter((c) => c.featured).slice(0, 2);
  // Collection spotlight: one collection that isn't already a row, changing each week.
  const spotPool = collections.filter((c) => !shelves.includes(c) && c.films.length >= 3);
  const spotlight = spotPool.length ? spotPool[week % spotPool.length] : null;
  // Anniversaries: films turning a round age this year.
  const thisYear = new Date().getFullYear();
  const MILESTONES = [10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];
  const anniversaries = films
    .filter((f) => MILESTONES.includes(thisYear - f.year))
    .sort((a, b) => a.year - b.year)
    .slice(0, 10);
  // Directors to know: a different handful each week, so the row stays fresh.
  const known = [...directors].sort((a, b) => b.films.length - a.films.length);
  const offset = (week * 5) % Math.max(known.length, 1);
  const toKnow = [...known.slice(offset), ...known.slice(0, offset)].slice(0, 12);

  return (
    <>
      <section className={`feature${pick.backdrop_url ? " has-still" : ""}`} style={tintStyle(pick.color)} aria-labelledby="feature-title">
        {pick.backdrop_url && (
          <div className="feature-still">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pick.backdrop_url} alt="" fetchPriority="high" />
          </div>
        )}
        <div className="feature-body">
          <p className="feature-kicker"><span className="dot" aria-hidden="true" />Film of the week</p>
          <h1 id="feature-title">{pick.title}</h1>
          <p className="feature-by">
            {pick.directors.map((d, i) => (
              <span key={d.id}>
                {i > 0 && " and "}
                <Link href={`/directors/${d.slug}`}>{d.name}</Link>
              </span>
            ))}
            <span className="muted-on-dark"> • {pick.year}</span>
          </p>
          {pick.synopsis && <p className="feature-line">{firstSentence(pick.synopsis)}</p>}
          <div className="actions">
            <Link className="button" href={`/films/${pick.slug}`}>About the film</Link>
            {embed && <TrailerButton embed={embed} title={pick.title} />}
          </div>
        </div>
        <FilmLink href={`/films/${pick.slug}`} className="feature-poster" tabIndex={-1} aria-hidden="true">
          <Poster title={pick.title} year={pick.year} directors={pick.directors.map((d) => d.name)} src={pick.poster_url} sizes="300px" priority />
        </FilmLink>
      </section>

      <div className="intro">
        <p>
          {films.length} films by {directors.length} directors from {facets.countries.length} countries.{" "}
          <span className="muted">From the silent era to this year&rsquo;s festivals.</span>
        </p>
      </div>

      {startHere.length > 0 && (
        <Row title="Start here" href="/films" linkLabel="All films">
          {startHere.map((f, i) => <FilmCard key={f.id} film={toCard(f)} priority={i < 3} />)}
        </Row>
      )}

      {spotlight && (
        <section className="spotlight" style={tintStyle(spotlight.films.find((f) => f.color)?.color)} aria-labelledby="spotlight-title">
          <div className="spotlight-text">
            <p className="spotlight-kicker">Collection spotlight</p>
            <h2 id="spotlight-title">{spotlight.title}</h2>
            {spotlight.description && <p className="spotlight-desc">{spotlight.description}</p>}
            <Link className="button ghost" href={`/collections/${spotlight.slug}`}>See all {spotlight.films.length} films</Link>
          </div>
          <ul className="spotlight-posters">
            {spotlight.films.slice(0, 5).map((f) => (
              <li key={f.id}>
                <FilmLink href={`/films/${f.slug}`} aria-label={`${f.title}, ${f.year}`}>
                  <Poster title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} sizes="(min-width: 900px) 180px, 30vw" />
                </FilmLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shelves.slice(0, 1).map((c) => (
        <Row key={c.id} title={c.title} intro={c.description ?? undefined} href={`/collections/${c.slug}`} linkLabel={`All ${c.films.length}`}>
          {c.films.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      ))}

      <Row title="Directors to know" href="/directors" linkLabel="All directors">
        {toKnow.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} />)}
      </Row>

      {anniversaries.length > 0 && (
        <Row title={`Anniversaries in ${thisYear}`} intro="Films turning 10, 25, 50 and more this year.">
          {anniversaries.map((f) => (
            <li key={f.id} className="anniversary" style={tintStyle(f.color)}>
              <FilmLink href={`/films/${f.slug}`}>
                <span className="anniversary-age">{thisYear - f.year}<span> years</span></span>
                <Poster title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} sizes="96px" />
                <span className="anniversary-title">{f.title}</span>
                <span className="anniversary-meta">{f.directors.map((d) => d.name).join(" and ")} • {f.year}</span>
              </FilmLink>
            </li>
          ))}
        </Row>
      )}

      {shelves.slice(1).map((c) => (
        <Row key={c.id} title={c.title} intro={c.description ?? undefined} href={`/collections/${c.slug}`} linkLabel={`All ${c.films.length}`}>
          {c.films.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      ))}

      {recent.length > 0 && (
        <Row title="Recent films" href="/films?sort=newest" linkLabel="All films">
          {recent.map((f) => <FilmCard key={f.id} film={toCard(f)} />)}
        </Row>
      )}

      <section className="row" aria-labelledby="decades-title">
        <div className="row-head">
          <h2 id="decades-title">Browse by decade</h2>
          <div className="row-tools"><Link href="/collections">All collections</Link></div>
        </div>
        <nav className="decades" aria-labelledby="decades-title">
          {facets.decades.map(([d, n]) => (
            <Link key={d} href={`/films?decade=${d}`}>
              {d}
              <sup>{n}</sup>
            </Link>
          ))}
        </nav>
      </section>

      {articles.length > 0 && (
        <section className="row" aria-labelledby="journal-title">
          <div className="row-head">
            <h2 id="journal-title">From the Journal</h2>
            <div className="row-tools"><Link href="/journal">All stories</Link></div>
          </div>
          <ul className="article-grid">
            {articles.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link href={`/journal/${a.slug}`}>
                  {a.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.cover_url} alt="" loading="lazy" />
                  )}
                  <span className="article-title">{a.title}</span>
                  {a.dek && <span className="article-dek">{a.dek}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
