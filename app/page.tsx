import { publicPageMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import EarlyAccessButton, { EarlyAccessGate } from "@/components/EarlyAccessButton";
import CurvedCarousel from "@/components/CurvedCarousel";
import Icon from "@/components/Icon";
import FeatureShowcase from "@/components/home/FeatureShowcase";
import { DirectorBio, DirectorDirectory, DirectorFilms, FilmAbout, FilmFeed, FilmSearch, MemberCommunity, MemberConversation, MemberProfile, WatchlistCollaboration, WatchlistCollection, WatchlistFollowing } from "@/components/home/screens";
import { getCommunityCollections, getMember } from "@/lib/community";
import { getDirectors, getFilms, toCard } from "@/lib/data";
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

// The Members section shows what a conversation looks like. These are samples, not real members;
// the preview is labelled "Example".
const SAMPLE_COMMENTS = [
  { handle: "amara", name: "Amara", when: "2 days ago", likes: 12,
    body: "Seeing Black Girl next to Borom Sarret makes so much sense. Sembène was building a whole language for African cinema.",
    replies: [{ handle: "leo", name: "Leo", when: "2 days ago", likes: 5, leo: true, body: "@amara Exactly why they open the list. Touki Bouki is next on my rewatch." }] },
  { handle: "kwame", name: "Kwame", when: "Yesterday", likes: 4,
    body: "Never heard of Sambizanga before this. Where can I watch it?",
    replies: [{ handle: "nia", name: "Nia", when: "Yesterday", likes: 3, body: "@kwame Open the film and check Where to watch for your region." }] },
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
  const withPoster = films.filter((f) => f.poster_url);

  // Films: a feed of well-known films, a real search with filters, and one film's page.
  const feed = [...essential, ...withPoster.filter((f) => f.featured && !essential.includes(f))].filter((f) => f.poster_url).slice(0, 18);
  const searched = withPoster.filter((f) => f.type === "feature" && f.genres.includes("Drama") && f.year >= 2010 && f.year < 2020);
  const about = bySlug.get("moonlight") ?? essential[0];
  // Directors: the directory, and one director's biography and films.
  const featured = dirBySlug.get("ryan-coogler") ?? toKnow[0];
  // Watchlists and members: Leo's profile and public watchlists, and the community's.
  const leo = await getMember("leo").catch(() => null);
  const leoLists = (leo?.collections ?? []).filter((c) => c.films.length >= 3);
  const showcaseList = leoLists.find((c) => c.title === "New Black Cinema") ?? collections.find((c) => c.films.length >= 6);
  const collabList = leoLists.find((c) => c.title === "The L.A. Rebellion") ?? showcaseList;
  const conversationList = leoLists.find((c) => c.title === "The Birth of African Cinema") ?? showcaseList;

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
      <section className="statement" aria-labelledby="films-title">
        <div className="statement-body">
          <h2 id="films-title">Films</h2>
          <p>Discover films by Black directors from around the world.</p>
        </div>
      </section>
      <FeatureShowcase label="Films" features={[
        { title: "Feed", icon: "film", path: "/films", text: "Discover feature films across genres, generations, and styles.",
          screen: <FilmFeed films={feed} total={films.length} /> },
        { title: "Search & Filter", icon: "filter", path: "/films?type=feature&genre=Drama&decade=2010s", text: "Find films by type, genre, country, decade, and other details.",
          screen: <FilmSearch films={searched.slice(0, 18)} count={searched.length} chips={["Feature", "Drama", "2010s"]} /> },
        ...(about ? [{ title: "About", icon: "clapperboard" as const, path: `/films/${about.slug}`, text: "Explore synopses, cast and crew, trailers, and where to watch.",
          screen: <FilmAbout film={about} /> }] : []),
      ]} />
      </div>

      <div className="home-block">
      <section className="statement" aria-labelledby="directors-title">
        <div className="statement-body">
          <h2 id="directors-title">Directors</h2>
          <p>Learn more about the people behind your favorite films.</p>
        </div>
      </section>
      <FeatureShowcase label="Directors" features={[
        { title: "Directory", icon: "users2", path: "/directors", text: "Discover Black filmmakers from around the world.",
          screen: <DirectorDirectory directors={toKnow.slice(0, 12)} total={directors.length} /> },
        ...(featured ? [
          { title: "Biography", icon: "user" as const, path: `/directors/${featured.slug}`, text: "Learn about their backgrounds, careers, and contributions to cinema.",
            screen: <DirectorBio director={featured} /> },
          { title: "Filmography", icon: "film" as const, path: `/directors/${featured.slug}`, text: "Explore their films and creative work.",
            screen: <DirectorFilms director={featured} /> },
        ] : []),
      ]} />
      </div>

      {showcaseList && (
      <div className="home-block">
      <section className="statement" aria-labelledby="watchlists-title">
        <div className="statement-body">
          <h2 id="watchlists-title">Watchlists</h2>
          <p>Create and share your own watchlists, or explore watchlists made by the community.</p>
        </div>
      </section>
      <FeatureShowcase label="Watchlists" features={[
        { title: "Collection", icon: "stack", path: `/c/${showcaseList.id}`, text: "Organize films into personalized watchlists.",
          screen: <WatchlistCollection list={showcaseList} /> },
        { title: "Following", icon: "bookmark", path: "/watchlists", text: "Discover and follow watchlists created by other film enthusiasts.",
          screen: <WatchlistFollowing lists={collections.filter((c) => c.films.length >= 3).slice(0, 9)} /> },
        ...(collabList ? [{ title: "Collaboration", icon: "userPlus" as const, path: `/c/${collabList.id}`, text: "Create watchlists together with other members.",
          screen: <WatchlistCollaboration list={collabList} owner={leo?.member ?? null} /> }] : []),
      ]} />
      </div>
      )}

      {leo && (
      <div className="home-block">
      <section className="statement" aria-labelledby="members-title">
        <div className="statement-body">
          <h2 id="members-title">Members</h2>
          <p>Create your profile, share your love for cinema, and connect with other film enthusiasts.</p>
        </div>
      </section>
      <FeatureShowcase label="Members" features={[
        { title: "Profile", icon: "userCircle", path: `/@${leo.member.handle}`, text: "Create a personal profile and share your interests with the community.",
          screen: <MemberProfile member={leo.member} lists={leoLists.slice(0, 9)} /> },
        { title: "Community", icon: "users", path: `/@${leo.member.handle}`, text: "Connect with other film enthusiasts who share your passion for cinema.",
          screen: <MemberCommunity member={leo.member} directors={toKnow.slice(0, 4)} lists={leoLists.slice(0, 6)} /> },
        ...(conversationList ? [{ title: "Conversation", icon: "comment" as const, path: `/c/${conversationList.id}`, example: true, text: "Share your thoughts, reply to comments, and join discussions about films.",
          screen: <MemberConversation list={conversationList} leo={leo.member} comments={SAMPLE_COMMENTS} /> }] : []),
      ]} />
      </div>
      )}
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
