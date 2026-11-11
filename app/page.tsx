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
  ["What is Pheelm?", "Pheelm is a platform to discover films by Black directors from around the world, explore the people behind them, and connect with other film enthusiasts."],
  ["Why was Pheelm created?", "Black directors have made significant contributions to cinema, yet many of their films remain overlooked or difficult to discover. Pheelm aims to make their work more visible and accessible to audiences everywhere."],
  ["What can I do on Pheelm?", "You can discover films, explore directors, save your favorites, create watchlists, and connect with a community of film enthusiasts."],
  ["Is Pheelm a streaming service?", "No. Pheelm is a film discovery platform. We help you find and learn about films, but we don’t host or stream them."],
  ["Is Pheelm free?", "Yes. Pheelm will be free to explore and use."],
  ["What is early access?", "Early access gives you the opportunity to explore Pheelm before its public launch, try its features, and share feedback to help us improve the platform."],
  ["When will Pheelm fully launch?", "We’re still working on Pheelm and don’t have an official public launch date yet."],
  ["Who can join?", "Anyone interested in cinema is welcome. Whether you’re a casual viewer, a film enthusiast, or a filmmaker, Pheelm is for you."],
  ["How can I support Pheelm?", "You can support us by joining the early access list, sharing Pheelm with others, and providing feedback as we build the platform."],
];


const ICONIC = [
  "sinners", "moonlight", "get-out", "black-panther", "12-years-a-slave", "do-the-right-thing", "boyz-n-the-hood",
  "daughters-of-the-dust", "selma", "malcolm-x", "us", "nope", "love-and-basketball", "fruitvale-station",
];

const FAMOUS = [
  "spike-lee", "ryan-coogler", "jordan-peele", "barry-jenkins", "ava-duvernay", "steve-mcqueen", "john-singleton",
  "julie-dash", "gina-prince-bythewood", "kasi-lemmons", "dee-rees", "ousmane-sembene", "melvin-van-peebles", "gordon-parks",
];

/**
 * The home page tells what Pheelm is in three parts (films, directors, community), each a short
 * statement followed by a row that shows it, then a closing call to sign up. While Pheelm is in
 * early access, every film, director and collection on it opens the sign-up sheet.
 */
export default async function Home() {
  const [films, directors, collections] = await Promise.all([
    getFilms(), getDirectors(), getCommunityCollections(),
  ]);

  // The hero row: iconic films, in this order. Any that aren't in the catalog are skipped.
  const bySlug = new Map(films.map((f) => [f.slug, f]));
  const essential = ICONIC.map((slug) => bySlug.get(slug)).filter((f) => !!f);
  const slides = essential.flatMap((f) => {
    const c = toCard(f);
    return c.poster_url ? [{ title: c.title, kicker: `${c.directors.join(" and ")} • ${c.year}`, image: c.poster_url.replace("/w500/", "/w780/"), alt: `Poster for ${c.title}` }] : [];
  });
  const dirBySlug = new Map(directors.map((d) => [d.slug, d]));
  const toKnow = FAMOUS.map((slug) => dirBySlug.get(slug)).filter((d) => !!d);
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
        <CurvedCarousel bare ariaLabel="Essential films" ink="var(--ink)" slides={slides} />
      </div>
      </div>

      <div className="home-block">
      <section className="statement" aria-labelledby="directors-title">
        <div className="statement-body">
          <h2 id="directors-title">Learn about the people behind your favorite films.</h2>
          <p>Explore directors from around the world and discover the films they&rsquo;ve made.</p>
        </div>
      </section>

      <Row title="Directors to know" bare>
        {toKnow.map((d) => <DirectorCard key={d.id} director={toDirectorSummary(d)} plain />)}
      </Row>
      </div>

      <div className="home-block">
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
      </div>
      </EarlyAccessGate>

      <div className="home-block">
      <section className="faq" aria-labelledby="faq-title">
        <div className="faq-body">
          <h2 id="faq-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQS.map(([q, a]) => (
              <details key={q} name="faq" className="faq-card">
                <summary>
                  <span>{q}</span>
                  <svg className="slate" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                    <path d="M3.5 10.5h17V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z" />
                    <g className="slate-arm">
                      <path d="M3.5 10.5V7.8a1 1 0 0 1 1-1h15a1 1 0 0 1 1 1v2.7z" />
                      <path d="M8 6.8l2.2 3.7M13 6.8l2.2 3.7" />
                    </g>
                  </svg>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      </div>

      <div className="home-block">
      <section className="statement is-cta" aria-labelledby="join-title">
        <div className="statement-body cta-card">
          <h2 id="join-title">Create your free account.</h2>
          <p>Save films, create watchlists, follow directors, and make Pheelm your own.</p>
          <div className="actions">
            <EarlyAccessButton />
          </div>
        </div>
      </section>
      </div>

    </>
  );
}
