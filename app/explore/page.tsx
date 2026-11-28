import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import Icon from "@/components/Icon";
import WatchedButton from "@/components/WatchedButton";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import TrailerButton from "@/components/TrailerButton";
import WatchlistButton from "@/components/WatchlistButton";
import { toCard } from "@/lib/data";
import { getExplore } from "@/lib/explore";
import { filmPath } from "@/lib/film-links";
import { countryName, runtimeLabel, tintStyle, trailerEmbed } from "@/lib/format";
import { publicPageMetadata } from "@/lib/seo";

export const revalidate = 3600; // the weekly picks change on Monday; admin saves refresh it right away
export const metadata: Metadata = publicPageMetadata("/explore");

const SIZES = "(min-width: 900px) 188px, (min-width: 640px) 27vw, 40vw";

/* eslint-disable @next/next/no-img-element */
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
            <div className="motw-media" aria-hidden="true">
              {motw.poster_url && <img className="motw-bg" src={motw.poster_url} alt="" />}
              <span className="motw-poster">
                <Poster title={motw.title} year={motw.year} directors={motw.directors.map((d) => d.name)} src={motw.poster_url} sizes="(min-width: 800px) 440px, 100vw" priority hero />
              </span>
            </div>
            <Link href={filmPath(motw.slug, motw.directors)} className="motw-link" aria-label={`${motw.title}, ${motw.year}`} />
            <div className="motw-text">
              <h2 className="motw-title">{motw.title}</h2>
              <p className="motw-meta">
                {[motw.directors.map((d) => d.name).join(" and "), String(motw.year), runtimeLabel(motw.runtime)].filter(Boolean).join(" · ")}
              </p>
              <div className="motw-actions">
                {embed ? (
                  <TrailerButton embed={embed} title={motw.title} className="motw-btn is-primary" label="Trailer" action="trailer" />
                ) : (
                  <a
                    className="motw-btn is-primary"
                    data-action="trailer"
                    aria-label="Find trailer on YouTube"
                    title="Trailer"
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent([motw.title, motw.year, ...motw.directors.map((d) => d.name), "trailer"].join(" "))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="play" className="solid" />
                  </a>
                )}
                <span className="motw-watchlist"><WatchlistButton filmId={motw.id} filmTitle={motw.title} /></span>
                <WatchedButton filmId={motw.id} title={motw.title} className="motw-btn" iconOnly filmHref={filmPath(motw.slug, motw.directors)} />
              </div>
            </div>
          </article>
        </section>
      )}

      {x.popular.length > 0 && (
        <Row title="Most popular" className="explore-row">
          {x.popular.map((f, i) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} priority={i < 3} />)}
        </Row>
      )}

      {x.recent.length > 0 && (
        <Row title="Recently added" className="explore-row">
          {x.recent.map((f) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} />)}
        </Row>
      )}

      {x.spotlights.length > 0 && (
        <section className="explore-section page" aria-labelledby="spotlight-h">
          <h2 id="spotlight-h" className="explore-h">Director spotlight</h2>
          <ul className="collection-list explore-lists">
            {x.spotlights.map((d) => <DirectorCard key={d.id} director={d} />)}
          </ul>
        </section>
      )}

      {x.aroundTheWorld.length > 0 && (
        <Row title="Around the world" className="explore-row">
          {x.aroundTheWorld.map(({ country, film }) => <FilmCard key={film.id} film={toCard(film)} note={countryName(country)} sizes={SIZES} />)}
        </Row>
      )}

      {x.watchlists.length > 0 && (
        <section className="explore-section page" aria-labelledby="lists-h">
          <h2 id="lists-h" className="explore-h">Community watchlists</h2>
          <ul className="collection-list explore-lists">
            {x.watchlists.map((c) => <CommunityTile key={c.id} c={c} />)}
          </ul>
        </section>
      )}

      <section className="explore-section page" aria-labelledby="keep-h">
        <h2 id="keep-h" className="explore-h">Keep exploring</h2>
        {x.browse.decades.length > 0 && (
          <div className="browse">
            <h3>Decades</h3>
            <ul className="browse-track">
              {x.browse.decades.map((d) => (
                <li key={d.href}>
                  <Link href={d.href} className={`browse-card is-decade era-${d.label.slice(0, 4)}`}>
                    <span className={`browse-big${Number(d.label.slice(0, 4)) < 1930 ? " is-long" : ""}`}>{Number(d.label.slice(0, 4)) < 1930 ? d.label : `’${d.label.slice(2)}`}</span>
                    <span className="browse-era" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {x.browse.genres.length > 0 && (
          <div className="browse">
            <h3>Genres</h3>
            <ul className="browse-track">
              {x.browse.genres.map((g) => (
                <li key={g.href}>
                  <Link href={g.href} className="browse-card is-genre" style={tintStyle(g.color)}>
                    <span className="browse-fan" aria-hidden="true">
                      {(g.posters ?? []).map((p, i) => p && <img key={i} src={p} alt="" loading="lazy" />)}
                    </span>
                    <span className="browse-name">{g.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {x.browse.services.length > 0 && (
          <div className="browse">
            <h3>Streaming</h3>
            <ul className="browse-track">
              {x.browse.services.map((v) => (
                <li key={v.href}>
                  <Link href={v.href} className="browse-card is-service">
                    {v.logo ? (
                      <>
                        <img className="browse-glow" src={v.logo} alt="" aria-hidden="true" loading="lazy" />
                        <img className="browse-logo" src={v.logo} alt="" loading="lazy" />
                      </>
                    ) : (
                      <span className="browse-logo browse-initial">{v.label[0]}</span>
                    )}
                    <span className="browse-name">{v.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
