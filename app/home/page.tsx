import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import DirectorCard, { Portrait } from "@/components/DirectorCard";
import FilmCard from "@/components/FilmCard";
import FollowButton from "@/components/FollowButton";
import Icon from "@/components/Icon";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import WatchlistButton from "@/components/WatchlistButton";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilms, toCard, toDirectorSummary } from "@/lib/data";
import { countryName, runtimeLabel, tintStyle } from "@/lib/format";
import { buildHomeData } from "@/lib/home";
import { privateMetadata } from "@/lib/seo";
import { getServerClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  ...privateMetadata("Home"),
  description: "This week’s films, community watchlists and directors to discover on Pheelm.",
};

/** The member's starting point. All discovery signals come from the public catalog. */
export default async function HomePage() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (db && !user) redirect("/login?next=/home");

  const [films, directors, collections, follows] = await Promise.all([
    getFilms(),
    getDirectors(),
    getCommunityCollections(),
    db && user ? db.from("follows").select("person_id").eq("user_id", user.id) : null,
  ]);
  const followed = new Set<string>((follows?.data ?? []).map((f) => f.person_id));
  const { filmOfWeek, popularFilms, featuredWatchlists, directorOfWeek, directorsToFollow } =
    buildHomeData(films, directors, collections, new Date(), followed);

  return (
    <div className={styles.home}>
      <h1 className="visually-hidden">Home</h1>

      <section className={styles.weeklyFilm} aria-labelledby="film-of-week">
        <h2 id="film-of-week" className={styles.sectionHeading}>Film of the week</h2>
        {filmOfWeek ? (
          <div className={`feature ${styles.feature}${filmOfWeek.backdrop_url ? " has-still" : ""}`} style={tintStyle(filmOfWeek.color)}>
            {filmOfWeek.backdrop_url && <div className="feature-still">
              <img src={filmOfWeek.backdrop_url} alt="" fetchPriority="high" />
            </div>}
            <div className="feature-body">
              <h3 className={styles.filmTitle}><Link href={`/films/${filmOfWeek.slug}`}>{filmOfWeek.title}</Link></h3>
              <p className="feature-by">
                {filmOfWeek.directors.map((d, i) => <span key={d.id}>
                  {i > 0 && " and "}<Link href={`/${d.in_directory === false ? "people" : "directors"}/${d.slug}`}>{d.name}</Link>
                </span>)}
                <span className="muted-on-dark"> • {filmOfWeek.year}{filmOfWeek.runtime ? ` • ${runtimeLabel(filmOfWeek.runtime)}` : ""}</span>
              </p>
              {(filmOfWeek.note || filmOfWeek.synopsis) && <p className={`feature-line ${styles.excerpt}`}>{filmOfWeek.note || filmOfWeek.synopsis}</p>}
              <div className="actions">
                <Link className="button" href={`/films/${filmOfWeek.slug}`}>Explore film<Icon name="arrowRight" /></Link>
                <WatchlistButton filmId={filmOfWeek.id} filmTitle={filmOfWeek.title} />
              </div>
            </div>
            <Link className="feature-poster" href={`/films/${filmOfWeek.slug}`} aria-label={`Explore ${filmOfWeek.title}`}>
              <Poster title={filmOfWeek.title} year={filmOfWeek.year} directors={filmOfWeek.directors.map((d) => d.name)} src={filmOfWeek.poster_url} sizes="240px" priority={!filmOfWeek.backdrop_url} />
            </Link>
          </div>
        ) : <p className={`empty-state ${styles.empty}`}>Our next film of the week is on its way. <Link href="/films">Explore films</Link>.</p>}
      </section>

      {popularFilms.length > 0 ? (
        <Row title="Most popular films" intro="The films appearing in the most public community watchlists." href="/films" linkLabel="All films">
          {popularFilms.map((film) => <FilmCard key={film.id} film={toCard(film)} />)}
        </Row>
      ) : <section className={styles.section} aria-labelledby="popular-films">
        <h2 id="popular-films">Most popular films</h2>
        <p className={`empty-state ${styles.empty}`}>Popular films will appear as the community shares watchlists. <Link href="/films">Find a film to save</Link>.</p>
      </section>}

      {featuredWatchlists.length > 0 ? (
        <Row title="From the community" intro="Featured watchlists, curated by Pheelm members." href="/watchlists?feed=featured" linkLabel="See all">
          {featuredWatchlists.map((c) => <CommunityTile key={c.id} c={c} />)}
        </Row>
      ) : <section className={styles.section} aria-labelledby="from-community">
        <h2 id="from-community">From the community</h2>
        <p className={`empty-state ${styles.empty}`}>Featured community watchlists will appear here. <Link href="/watchlists">Explore watchlists</Link>.</p>
      </section>}

      <section className={styles.section} aria-labelledby="director-of-week">
        <h2 id="director-of-week" className={styles.sectionHeading}>Director of the week</h2>
        {directorOfWeek ? <div className={`person-head ${styles.directorSpotlight}`}>
          <Link href={`/directors/${directorOfWeek.slug}`} aria-label={`Explore ${directorOfWeek.name}`}><Portrait director={directorOfWeek} /></Link>
          <div className={styles.directorBody}>
            <h3 className={styles.directorName}><Link href={`/directors/${directorOfWeek.slug}`}>{directorOfWeek.name}</Link></h3>
            <p className="muted">{[directorOfWeek.country && countryName(directorOfWeek.country), `${directorOfWeek.films.length} ${directorOfWeek.films.length === 1 ? "film" : "films"} on Pheelm`].filter(Boolean).join(" • ")}</p>
            {directorOfWeek.bio && <p className={styles.excerpt}>{directorOfWeek.bio.split(/\n{2,}/)[0]}</p>}
          </div>
          <div className={`actions ${styles.directorActions}`}>
            <Link className="button ghost" href={`/directors/${directorOfWeek.slug}`}>Explore director<Icon name="arrowRight" /></Link>
            <FollowButton personId={directorOfWeek.id} name={directorOfWeek.name} />
          </div>
        </div> : <p className={`empty-state ${styles.empty}`}>Meet the filmmakers behind the films. <Link href="/directors">Explore directors</Link>.</p>}
      </section>

      {directorsToFollow.length > 0 ? (
        <Row title="Directors to follow" intro="Follow a director to hear when their films are added to Pheelm." href="/directors" linkLabel="See all">
          {directorsToFollow.map((director) => <DirectorCard key={director.id} director={toDirectorSummary(director)} footer={
            <div className={styles.followAction}><FollowButton personId={director.id} name={director.name} /></div>
          } />)}
        </Row>
      ) : <section className={styles.section} aria-labelledby="directors-to-follow">
        <h2 id="directors-to-follow">Directors to follow</h2>
        <p className={`empty-state ${styles.empty}`}>You’re all caught up. <Link href="/directors">Explore the director directory</Link>.</p>
      </section>}

      <section className={styles.section} aria-labelledby="explore-further">
        <div className="section-head"><h2 id="explore-further">Explore Further</h2></div>
        <ul className={`ways ${styles.explore}`}>
          {[
            { title: "Films", text: "Find your next film by genre, country or decade.", href: "/films", icon: "film" as const },
            { title: "Documentaries", text: "Explore real stories and new perspectives.", href: "/films?type=documentary", icon: "clapper" as const },
            { title: "Short films", text: "Discover a world of cinema in a shorter form.", href: "/films?type=short", icon: "play" as const },
            { title: "Watchlists", text: "Find a way into cinema through someone else’s selection.", href: "/watchlists", icon: "stack" as const },
          ].map((item) => <li key={item.href}>
            <Link className={styles.exploreLink} href={item.href}>
              <Icon name={item.icon} /><h3>{item.title}</h3><p>{item.text}</p><Icon className={styles.exploreArrow} name="arrowRight" />
            </Link>
          </li>)}
        </ul>
      </section>
    </div>
  );
}
