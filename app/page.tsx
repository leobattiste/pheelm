import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import EarlyAccessButton, { EarlyAccessGate } from "@/components/EarlyAccessButton";
import FilmCard from "@/components/FilmCard";
import Row from "@/components/Row";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { PAGE_COPY, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 300;
export const metadata: Metadata = publicPageMetadata("/");

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Rotate a list by a week-based offset, so rows change each week without being random per visit. */
function rotate<T>(items: T[], week: number, step: number): T[] {
  if (!items.length) return items;
  const at = (week * step) % items.length;
  return [...items.slice(at), ...items.slice(0, at)];
}

/**
 * The home page tells what Pheelm is in three parts (films, directors, community), each a short
 * statement followed by a row that shows it, then a closing call to sign up. While Pheelm is in
 * early access, every film, director and collection on it opens the sign-up sheet.
 */
export default async function Home() {
  const [films, directors, collections] = await Promise.all([
    getFilms(), getDirectors(), getCommunityCollections(),
  ]);
  const week = Math.floor(Date.now() / WEEK);

  // Essential films: the ones with an editors' note, then the featured ones if there are few.
  const noted = films.filter((f) => f.note);
  const essential = rotate(noted.length >= 8 ? noted : films.filter((f) => f.featured), week, 7).slice(0, 16);
  const toKnow = rotate([...directors].sort((a, b) => b.films.length - a.films.length).slice(0, 80), week, 5).slice(0, 12);
  const shelf = collections.filter((c) => c.films.length >= 3).slice(0, 12);

  // For search engines: the site, with a search box that opens the Films page's search.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        potentialAction: { "@type": "SearchAction", target: `${SITE_URL}/films?q={search_term_string}`, "query-input": "required name=search_term_string" },
      },
      { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/apple-icon` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <EarlyAccessGate>
      <div className="home-lead">
      <section className="statement is-hero" aria-labelledby="home-title">
        <div className="statement-body">
          <h1 id="home-title">Discover films by Black directors.</h1>
          <p>Pheelm is a platform to discover and learn more about films directed by Black filmmakers around the world.</p>
          <div className="actions">
            <EarlyAccessButton />
          </div>
        </div>
      </section>

      <Row title="Essential films" bare interactive fit>
        {essential.map((f, i) => <FilmCard key={f.id} film={toCard(f)} priority={i < 4} posterOnly sizes="(min-width: 900px) 34vw, 72vw" />)}
      </Row>
      </div>

      <section className="statement" aria-labelledby="directors-title">
        <div className="statement-body">
          <h2 id="directors-title">Learn about the people behind your favorite films.</h2>
          <p>Explore directors from around the world and discover the films they&rsquo;ve made.</p>
        </div>
      </section>

      <Row title="Directors to know" bare>
        {toKnow.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} />)}
      </Row>

      <section className="statement" aria-labelledby="community-title">
        <div className="statement-body">
          <h2 id="community-title">Connect with other film enthusiasts.</h2>
          <p>
            Discover community-curated collections, share your favorites, and connect with people who share your love of
            cinema.
          </p>
        </div>
      </section>

      {shelf.length > 0 && (
        <Row title="Collections" bare>
          {shelf.map((c) => <CommunityTile key={c.id} c={c} showOwner={!c.staff_pick} />)}
        </Row>
      )}
      </EarlyAccessGate>

      <section className="statement is-cta" aria-labelledby="join-title">
        <div className="statement-body">
          <h2 id="join-title">Create your free account.</h2>
          <p>Save films, create watchlists, follow directors, and make Pheelm your own.</p>
          <div className="actions">
            <EarlyAccessButton>Sign up for free</EarlyAccessButton>
          </div>
        </div>
      </section>

    </>
  );
}
