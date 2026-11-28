import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import { Portrait } from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import Icon, { type IconName } from "@/components/Icon";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import TrailerButton from "@/components/TrailerButton";
import WatchlistButton from "@/components/WatchlistButton";
import { toCard } from "@/lib/data";
import { getExplore } from "@/lib/explore";
import { filmPath } from "@/lib/film-links";
import { countryName, runtimeLabel, trailerEmbed } from "@/lib/format";
import { publicPageMetadata } from "@/lib/seo";
import { INSTAGRAM_URL } from "@/lib/site";

export const revalidate = 3600; // the weekly picks change on Monday; admin saves refresh it right away
export const metadata: Metadata = publicPageMetadata("/explore");

const SIZES = "(min-width: 900px) 188px, (min-width: 640px) 27vw, 40vw";

export default async function ExplorePage() {
  const x = await getExplore();
  const motw = x.movieOfTheWeek;
  const embed = motw ? trailerEmbed(motw.trailer_url) : null;

  const actions: { href: string; icon: IconName; title: string; text: string; external?: boolean }[] = [
    { href: "/submit", icon: "plus", title: "Suggest a film", text: "Missing a film by a Black director? Tell us." },
    { href: "/me#new-collection", icon: "stack", title: "Create a watchlist", text: "Gather films to watch, alone or with friends." },
    { href: "/films", icon: "film", title: "Mark what you’ve watched", text: "Keep track of every film you’ve seen." },
    ...(motw ? [{ href: `${filmPath(motw.slug, motw.directors)}#comments`, icon: "comment" as IconName, title: "Join the conversation", text: `Say what you thought of ${motw.title}.` }] : []),
    { href: "/directors", icon: "users2", title: "Follow directors", text: "Hear when the directors you love get new films." },
    ...(INSTAGRAM_URL ? [{ href: INSTAGRAM_URL, icon: "instagram" as IconName, title: "Follow Pheelm", text: "New films and picks on Instagram.", external: true }] : []),
  ];

  return (
    <div className="explore">
      <header className="page-head intro-head page">
        <h1>Explore</h1>
        <p className="lead">This week’s picks from Pheelm. New every Monday.</p>
      </header>

      {motw && (
        <section className="explore-section page" aria-labelledby="motw-h">
          <h2 id="motw-h" className="explore-h">Movie of the week</h2>
          <article className="motw">
            <Link href={filmPath(motw.slug, motw.directors)} className="motw-poster" aria-label={`${motw.title}, ${motw.year}`}>
              <Poster title={motw.title} year={motw.year} directors={motw.directors.map((d) => d.name)} src={motw.poster_url} sizes="(min-width: 800px) 280px, 40vw" priority />
            </Link>
            <div className="motw-text">
              <h3 className="motw-title"><Link href={filmPath(motw.slug, motw.directors)}>{motw.title}</Link></h3>
              <p className="motw-meta">
                {motw.directors.length > 0 && <>Directed by {motw.directors.map((d) => d.name).join(" and ")} · </>}
                {motw.year}{runtimeLabel(motw.runtime) ? ` · ${runtimeLabel(motw.runtime)}` : ""}
              </p>
              {motw.synopsis && <p className="motw-synopsis">{motw.synopsis}</p>}
              <div className="motw-actions film-actions">
                {embed ? (
                  <TrailerButton embed={embed} title={motw.title} className="pill-button primary" label="Trailer" action="trailer" />
                ) : (
                  <Link className="pill-button primary" href={filmPath(motw.slug, motw.directors)}>See the film</Link>
                )}
                <WatchlistButton filmId={motw.id} filmTitle={motw.title} />
              </div>
            </div>
          </article>
        </section>
      )}

      {x.popular.length > 0 && (
        <Row title="Most popular" intro="The films on Pheelm people are watching most around the world." href="/films" className="explore-row">
          {x.popular.map((f, i) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} priority={i < 3} />)}
        </Row>
      )}

      {x.recent.length > 0 && (
        <Row title="Recently added" intro="New on Pheelm." href="/films" className="explore-row">
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
              <span className="spotlight-meta">
                {[x.spotlight.country ? countryName(x.spotlight.country) : null, `${x.spotlight.films.length} films on Pheelm`].filter(Boolean).join(" · ")}
              </span>
              {x.spotlight.bio && <span className="spotlight-bio">{x.spotlight.bio}</span>}
            </span>
          </Link>
        </section>
      )}
      {x.spotlight && x.spotlight.films.length > 0 && (
        <Row title={`Films by ${x.spotlight.name}`} bare className="explore-row spotlight-row">
          {x.spotlight.films.map((f) => <FilmCard key={f.id} film={toCard(f)} sizes={SIZES} />)}
        </Row>
      )}

      {x.aroundTheWorld.length > 0 && (
        <Row title="Around the world" intro="A popular film from a different country, for eight countries this week." className="explore-row">
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

      <section className="explore-section page" aria-labelledby="join-h">
        <h2 id="join-h" className="explore-h">Join in</h2>
        <ul className="explore-actions">
          {actions.map((a) => (
            <li key={a.title}>
              <Link href={a.href} {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                <Icon name={a.icon} />
                <span><strong>{a.title}</strong><span>{a.text}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
