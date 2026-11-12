import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import EarlyAccessButton, { EarlyAccessGate } from "@/components/EarlyAccessButton";
import CurvedCarousel from "@/components/CurvedCarousel";
import Icon from "@/components/Icon";
import FeatureSection from "@/components/home/FeatureSection";
import { getFilms, toCard } from "@/lib/data";
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

// The four parts of Pheelm, each with a screenshot of its real page (public/home).
const FEATURES = [
  { id: "films", shot: "films", title: "Films", intro: "Discover films by Black directors from around the world.",
    alt: "The Films page: a search bar, filters and film posters.",
    features: [
      { icon: "film" as const, title: "Feed", text: "Discover feature films across genres, generations, and styles." },
      { icon: "filter" as const, title: "Search & Filter", text: "Find films by type, genre, country, decade, and other details." },
      { icon: "clapperboard" as const, title: "About", text: "Explore synopses, cast and crew, trailers, and where to watch." },
    ] },
  { id: "directors", shot: "directors", title: "Directors", intro: "Learn more about the people behind your favorite films.",
    alt: "The Directors page: cards for directors such as Spike Lee, Charles Burnett and Ousmane Sembène, each with posters of their films.",
    features: [
      { icon: "users2" as const, title: "Directory", text: "Discover Black filmmakers from around the world." },
      { icon: "user" as const, title: "Biography", text: "Learn about their backgrounds, careers, and contributions to cinema." },
      { icon: "film" as const, title: "Filmography", text: "Explore their films and creative work." },
    ] },
  { id: "watchlists", shot: "watchlists", title: "Watchlists", intro: "Create and share your own watchlists, or explore watchlists made by the community.",
    alt: "The Watchlists page: community watchlists such as The Birth of African Cinema and Nollywood, each with three posters.",
    features: [
      { icon: "stack" as const, title: "Collection", text: "Organize films into personalized watchlists." },
      { icon: "bookmark" as const, title: "Following", text: "Discover and follow watchlists created by other film enthusiasts." },
      { icon: "userPlus" as const, title: "Collaboration", text: "Create watchlists together with other members." },
    ] },
  { id: "members", shot: "members", title: "Members", intro: "Create your profile, share your love for cinema, and connect with other film enthusiasts.",
    alt: "Leo's profile on Pheelm: his photo, name and handle, and his watchlists.",
    features: [
      { icon: "userCircle" as const, title: "Profile", text: "Create a personal profile and share your interests with the community." },
      { icon: "users" as const, title: "Community", text: "Connect with other film enthusiasts who share your passion for cinema." },
      { icon: "comment" as const, title: "Conversation", text: "Share your thoughts, reply to comments, and join discussions about films." },
    ] },
];

/**
 * The home page tells what Pheelm is in three parts (films, directors, community), each a short
 * statement followed by a row that shows it, then a closing call to sign up. While Pheelm is in
 * early access, every film, director and collection on it opens the sign-up sheet.
 */
export default async function Home() {
  const films = await getFilms();

  // The hero row: iconic films, in this order. Any that aren't in the catalog are skipped.
  const bySlug = new Map(films.map((f) => [f.slug, f]));
  const essential = ICONIC.map((slug) => bySlug.get(slug)).filter((f) => !!f);
  const slides = essential.flatMap((f) => {
    const c = toCard(f);
    return c.poster_url ? [{ title: c.title, kicker: `${c.directors.join(" and ")} • ${c.year}`, image: c.poster_url.replace("/w500/", "/w780/"), alt: `Poster for ${c.title}` }] : [];
  });
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

      {FEATURES.map((f) => (
        <div className="home-block" key={f.id}>
          <FeatureSection {...f} />
        </div>
      ))}
      </EarlyAccessGate>

      <div className="home-block">
      <section className="faq" aria-labelledby="faq-title">
        <div className="faq-body">
          <h2 id="faq-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQS.map(([q, a], i) => (
              <details key={q} name="faq" className="faq-card" open={i === 0}>
                <summary>
                  <span>{q}</span>
                  <span className="slate" aria-hidden="true">
                    <Icon name="clapperboard" className="slate-closed" />
                    <Icon name="clapper" className="slate-open" />
                  </span>
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
