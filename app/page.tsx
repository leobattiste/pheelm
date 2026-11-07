import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import Row from "@/components/Row";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFacets, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { PAGE_COPY } from "@/lib/site";

export const revalidate = 300;
export const metadata: Metadata = { description: PAGE_COPY.home };

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Rotate a list by a week-based offset, so rows change each week without being random per visit. */
function rotate<T>(items: T[], week: number, step: number): T[] {
  if (!items.length) return items;
  const at = (week * step) % items.length;
  return [...items.slice(at), ...items.slice(0, at)];
}

/**
 * The home page tells what Pheelm is in three parts (films, directors, community), each a short
 * statement on black followed by a row that shows it.
 */
export default async function Home() {
  const [films, directors, collections, facets] = await Promise.all([
    getFilms(), getDirectors(), getCommunityCollections(), getFacets(),
  ]);
  const week = Math.floor(Date.now() / WEEK);

  // Essential films: the ones with an editors' note, then the featured ones if there are few.
  const noted = films.filter((f) => f.note);
  const essential = rotate(noted.length >= 8 ? noted : films.filter((f) => f.featured), week, 7).slice(0, 16);
  const toKnow = rotate([...directors].sort((a, b) => b.films.length - a.films.length).slice(0, 80), week, 5).slice(0, 12);
  const shelf = collections.filter((c) => c.films.length >= 3).slice(0, 12);

  return (
    <>
      <div className="home-lead">
      <section className="statement is-hero" aria-labelledby="home-title">
        <div className="statement-body">
          <h1 id="home-title">Discover and learn more about films directed by Black filmmakers around the world.</h1>
          <p>{films.length} films, from the silent era to this year&rsquo;s festivals, and where to watch them.</p>
          <div className="actions">
            <Link className="button" href="/films">Browse films</Link>
          </div>
        </div>
      </section>

      <Row title="Essential films" bare interactive fit>
        {essential.map((f, i) => <FilmCard key={f.id} film={toCard(f)} priority={i < 4} posterOnly sizes="(min-width: 900px) 34vw, 72vw" />)}
      </Row>
      </div>

      <section className="statement" aria-labelledby="directors-title">
        <div className="statement-body">
          <h2 id="directors-title">Get to know the directors, from Oscar Micheaux in the 1920s to the filmmakers winning at Cannes today.</h2>
          <p>
            {directors.length} directors from {facets.countries.length} countries. Follow the ones you love to hear when
            they have a new film.
          </p>
          <div className="actions">
            <Link className="button" href="/directors">Browse directors</Link>
          </div>
        </div>
      </section>

      <Row title="Directors to know" bare>
        {toKnow.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} />)}
      </Row>

      <section className="statement" aria-labelledby="community-title">
        <div className="statement-body">
          <h2 id="community-title">Explore collections made by Pheelm and the community, from film movements to personal favorites.</h2>
          <p>Members&rsquo; collections sit alongside ours. Make your own from your Watchlist and share it.</p>
          <div className="actions">
            <Link className="button" href="/collections">Explore collections</Link>
          </div>
        </div>
      </section>

      {shelf.length > 0 && (
        <Row title="Collections" bare>
          {shelf.map((c) => <CommunityTile key={c.id} c={c} showOwner={!c.staff_pick} />)}
        </Row>
      )}

      <section className="statement is-cta" aria-labelledby="join-title">
        <div className="statement-body">
          <h2 id="join-title">Start a Watchlist and keep track of every film you want to see.</h2>
          <p>Create a free account to save films, follow directors and make your own collections.</p>
          <div className="actions">
            <Link className="button" href="/login">Join Pheelm</Link>
          </div>
        </div>
      </section>
    </>
  );
}
