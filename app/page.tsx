import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard from "@/components/DirectorCard";
import EarlyAccessButton, { EarlyAccessGate } from "@/components/EarlyAccessButton";
import CurvedCarousel from "@/components/CurvedCarousel";
import Row from "@/components/Row";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { PAGE_COPY, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 300;
export const metadata: Metadata = publicPageMetadata("/");

const FAQS: [string, string][] = [
  ["What is Pheelm?", "Pheelm is a platform to discover films directed or co-directed by Black filmmakers from around the world. Explore films, directors and watchlists in one place."],
  ["Is Pheelm free?", "Yes. Creating an account and using Pheelm costs nothing."],
  ["Why do I need an account?", "While Pheelm is in early access, an account is how you get in. It also lets you save films, follow directors, create watchlists, comment and suggest films."],
  ["How do I get early access?", "Select Get Early Access, or sign in if you already have an account, and enter your email. There are no passwords: we send you a link or code."],
  ["Who is Pheelm for?", "Anyone curious about cinema by Black directors: film fans, filmmakers, researchers and people looking for something new to watch."],
  ["Where can I watch the films?", "Each film page shows where it is available to stream, rent or buy, depending on your country."],
];

const ICONIC = [
  "sinners", "moonlight", "get-out", "black-panther", "12-years-a-slave", "do-the-right-thing", "boyz-n-the-hood",
  "daughters-of-the-dust", "selma", "malcolm-x", "us", "nope", "love-and-basketball", "fruitvale-station",
];

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

  // The hero row: iconic films, in this order. Any that aren't in the catalog are skipped.
  const bySlug = new Map(films.map((f) => [f.slug, f]));
  const essential = ICONIC.map((slug) => bySlug.get(slug)).filter((f) => !!f);
  const slides = essential.flatMap((f) => {
    const c = toCard(f);
    return c.poster_url ? [{ title: c.title, kicker: `${c.directors.join(" and ")} • ${c.year}`, image: c.poster_url, alt: `Poster for ${c.title}` }] : [];
  });
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
      { "@type": "FAQPage", mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
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

      <div className="home-carousel">
        <CurvedCarousel ariaLabel="Essential films" ink="var(--ink)" slides={slides} />
      </div>
      </div>

      <section className="statement" aria-labelledby="directors-title">
        <div className="statement-body">
          <h2 id="directors-title">Learn about the people behind your favorite films.</h2>
          <p>Explore directors from around the world and discover the films they&rsquo;ve made.</p>
        </div>
      </section>

      <Row title="Directors to know" bare>
        {toKnow.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} plain />)}
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
        <Row title="Watchlists" bare>
          {shelf.map((c) => <CommunityTile key={c.id} c={c} showOwner={!c.staff_pick} plain />)}
        </Row>
      )}
      </EarlyAccessGate>

      <section className="faq" aria-labelledby="faq-title">
        <div className="faq-body">
          <h2 id="faq-title">Frequently asked questions</h2>
          <div className="faq-list">
            {FAQS.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="statement is-cta" aria-labelledby="join-title">
        <div className="statement-body">
          <h2 id="join-title">Create your free account.</h2>
          <p>Save films, create watchlists, follow directors, and make Pheelm your own.</p>
          <div className="actions">
            <EarlyAccessButton />
          </div>
        </div>
      </section>

    </>
  );
}
