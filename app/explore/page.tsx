import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import { Portrait } from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import FilmMenu from "@/components/FilmMenu";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import TrailerButton from "@/components/TrailerButton";
import WatchlistButton from "@/components/WatchlistButton";
import { toCard } from "@/lib/data";
import { getExplore } from "@/lib/explore";
import { filmPath } from "@/lib/film-links";
import { countryName, runtimeLabel, trailerEmbed } from "@/lib/format";
import { publicPageMetadata } from "@/lib/seo";

export const revalidate = 3600; // the weekly picks change on Monday; admin saves refresh it right away
export const metadata: Metadata = publicPageMetadata("/explore");

const SIZES = "(min-width: 900px) 188px, (min-width: 640px) 27vw, 40vw";

export default async function ExplorePage() {
  const x = await getExplore();
  const motw = x.movieOfTheWeek;
  const embed = motw ? trailerEmbed(motw.trailer_url) : null;

  return (
    <div className="explore">
      <header className="page-head intro-head page">
        <h1>Explore</h1>
        <p className="lead">This week’s picks from Pheelm. New every Monday.</p>
      </header>

      {motw && (
        <section className="explore-section page" aria-label="Movie of the week">
          <article className="motw">
            <Link href={filmPath(motw.slug, motw.directors)} className="motw-poster" aria-label={`${motw.title}, ${motw.year}`}>
              <Poster title={motw.title} year={motw.year} directors={motw.directors.map((d) => d.name)} src={motw.poster_url} sizes="(min-width: 800px) 280px, 100vw" priority hero />
            </Link>
            <div className="motw-text">
              <h2 className="motw-title"><Link href={filmPath(motw.slug, motw.directors)}>{motw.title}</Link></h2>
              <p className="motw-meta">
                {[motw.directors.map((d) => d.name).join(" and "), String(motw.year), runtimeLabel(motw.runtime)].filter(Boolean).join(" · ")}
              </p>
              <div className="motw-actions film-actions">
                {embed ? (
                  <TrailerButton embed={embed} title={motw.title} className="pill-button primary" label="Trailer" action="trailer" />
                ) : (
                  <a
                    className="pill-button primary"
                    data-action="trailer"
                    aria-label="Find trailer on YouTube"
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent([motw.title, motw.year, ...motw.directors.map((d) => d.name), "trailer"].join(" "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Trailer
                  </a>
                )}
                <WatchlistButton filmId={motw.id} filmTitle={motw.title} />
                <FilmMenu filmId={motw.id} slug={motw.slug} title={motw.title} />
              </div>
            </div>
          </article>
        </section>
      )}

      {x.popular.length > 0 && (
        <Row title="Most popular" href="/films" className="explore-row">
          {x.popular.map((f, i) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} priority={i < 3} />)}
        </Row>
      )}

      {x.recent.length > 0 && (
        <Row title="Recently added" href="/films" className="explore-row">
          {x.recent.map((f) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} />)}
        </Row>
      )}

      {x.spotlight && (
        <section className="explore-section page" aria-labelledby="spotlight-h">
          <h2 id="spotlight-h" className="explore-h">Director spotlight</h2>
          <Link href={`/directors/${x.spotlight.slug}`} className="spotlight-head">
            <Portrait director={x.spotlight} className="spotlight-portrait" />
            <span className="spotlight-text">
              <span className="spotlight-name">{x.spotlight.name}</span>
              {x.spotlight.country && <span className="spotlight-meta">{countryName(x.spotlight.country)}</span>}
            </span>
          </Link>
        </section>
      )}
      {x.spotlight && x.spotlight.films.length > 0 && (
        <Row title={`Films by ${x.spotlight.name}`} bare className="explore-row spotlight-row">
          {x.spotlight.films.map((f) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} posterOnly />)}
        </Row>
      )}

      {x.aroundTheWorld.length > 0 && (
        <Row title="Around the world" className="explore-row">
          {x.aroundTheWorld.map(({ country, film }) => <FilmCard key={film.id} film={toCard(film)} note={countryName(country)} sizes={SIZES} />)}
        </Row>
      )}

      {x.watchlists.length > 0 && (
        <section className="explore-section page" aria-labelledby="lists-h">
          <div className="explore-h-row">
            <h2 id="lists-h" className="explore-h">Community watchlists</h2>
            <Link href="/watchlists" className="explore-more">See all</Link>
          </div>
          <ul className="collection-list explore-lists">
            {x.watchlists.map((c) => <CommunityTile key={c.id} c={c} />)}
          </ul>
        </section>
      )}

      <section className="explore-section page" aria-labelledby="keep-h">
        <h2 id="keep-h" className="explore-h">Keep exploring</h2>
        {([["Decades", x.browse.decades], ["Genres", x.browse.genres], ["Services", x.browse.services], ["Themes", x.browse.themes]] as const).map(([label, items]) =>
          items.length > 0 && (
            <div key={label} className="explore-chips">
              <h3>{label}</h3>
              <ul>{items.map((i) => <li key={i.href}><Link href={i.href} className="pill-button">{i.label}</Link></li>)}</ul>
            </div>
          ),
        )}
      </section>
    </div>
  );
}
