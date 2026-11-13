import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityTile from "@/components/CommunityTile";
import FilmCard from "@/components/FilmCard";
import Icon, { type IconName } from "@/components/Icon";
import Poster from "@/components/Poster";
import Row from "@/components/Row";
import UserAvatar from "@/components/UserAvatar";
import Greeting from "@/components/home/Greeting";
import { commentPlace } from "@/lib/comments";
import { getCommunityCollections } from "@/lib/community";
import { getFilms, toCard } from "@/lib/data";
import { listJoin, tintStyle } from "@/lib/format";
import { getHome, type HomeData } from "@/lib/home";
import { privateMetadata } from "@/lib/seo";
import { getServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = privateMetadata("Home");

type Said = { id: string; body: string; spoiler: boolean | null; created_at: string; user_id: string; list_id: string | null; film_id: string | null; lists: { title: string } | null; films: { title: string; slug: string } | null };
type Author = { id: string; handle: string; display_name: string | null; avatar_url: string | null };

/**
 * Home, for signed-in members: one thing to do next, new films from directors you follow, your
 * Watchlist, films like the ones you've watched, watchlists to follow, what people are saying, and
 * ways to keep discovering. Sections with nothing to show are left out.
 */
export default async function HomePage() {
  const db = await getServerClient();
  if (!db) redirect("/");
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/home");

  const films = await getFilms();
  const [home, lists, saves, comments] = await Promise.all([
    getHome(db, user.id, films),
    getCommunityCollections({ sort: "popular", limit: 24 }).catch(() => []),
    db.from("list_saves").select("list_id").eq("user_id", user.id),
    db.from("list_comments").select("id, body, spoiler, created_at, user_id, list_id, film_id, lists(title), films(title, slug)")
      .is("removed_at", null).neq("user_id", user.id).order("created_at", { ascending: false }).limit(12),
  ]);

  const followedLists = new Set(((saves.data ?? []) as { list_id: string }[]).map((s) => s.list_id));
  const suggestions = lists.filter((c) => c.owner?.id !== user.id && !followedLists.has(c.id)).slice(0, 6);

  const said = ((comments.error ? [] : comments.data ?? []) as unknown as Said[]).filter((c) => (c.film_id ? c.films : c.lists)).slice(0, 3);
  const authorIds = [...new Set(said.map((c) => c.user_id))];
  const { data: authorRows } = authorIds.length
    ? await db.from("member_profiles").select("id, handle, display_name, avatar_url").in("id", authorIds)
    : { data: [] };
  const authors = new Map(((authorRows ?? []) as Author[]).map((a) => [a.id, a]));
  const voices = said.filter((c) => authors.has(c.user_id));

  const decades = [...new Set(films.map((f) => Math.floor(f.year / 10) * 10))].sort((a, b) => b - a).slice(0, 6);

  return (
    <section className="page home-member">
      <header className="home-head">
        <Greeting name={home.name} />
        {home.unread > 0 && (
          <Link className="home-unread" href="/notifications"><span className="home-unread-dot" aria-hidden="true" />{home.unread} new {home.unread === 1 ? "notification" : "notifications"}</Link>
        )}
      </header>

      <NextStep home={home} />

      {home.followed.length > 0 && (
        <Row title={home.followed.some((f) => f.isNew) ? "New from directors you follow" : "From directors you follow"} href="/me#following" linkLabel="Following">
          {home.followed.map(({ film, isNew }) => <FilmCard key={film.id} film={toCard(film)} extra={isNew ? "New" : undefined} />)}
        </Row>
      )}

      {home.watchlist.length > 0 && (
        <Row title="Your Watchlist" href="/me" linkLabel={home.watchlistTotal > home.watchlist.length ? `See all ${home.watchlistTotal}` : "See all"}>
          {home.watchlist.map((film) => <FilmCard key={film.id} film={toCard(film)} />)}
        </Row>
      )}

      {home.because && (
        <Row title={`Because you watched ${home.because.seed.title}`}>
          {home.because.films.map((film) => <FilmCard key={film.id} film={toCard(film)} />)}
        </Row>
      )}

      {suggestions.length > 0 && (
        <section className="home-section" aria-labelledby="home-lists">
          <div className="section-head">
            <h2 id="home-lists">Watchlists to follow</h2>
            <Link className="button ghost small" href="/watchlists">All watchlists</Link>
          </div>
          <ul className="collection-list home-lists">{suggestions.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
        </section>
      )}

      {voices.length > 0 && (
        <section className="home-section" aria-labelledby="home-said">
          <div className="section-head"><h2 id="home-said">What people are saying</h2></div>
          <ul className="home-voices">
            {voices.map((c) => {
              const a = authors.get(c.user_id)!;
              const place = commentPlace(c);
              return (
                <li key={c.id}>
                  <Link className="home-voice" href={place.href}>
                    <UserAvatar person={a} />
                    <span className="home-voice-body">
                      <span className="home-voice-who"><strong>{a.display_name || `@${a.handle}`}</strong> on {place.title}</span>
                      <span className="home-voice-text">{c.spoiler ? "Contains spoilers. Open to read." : c.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="home-section" aria-labelledby="home-discover">
        <div className="section-head"><h2 id="home-discover">Keep discovering</h2></div>
        <ul className="home-tiles">
          {([
            ["/random", "shuffle", "Shuffle a film", "Let Pheelm pick one for you"],
            ["/directors", "users2", "Directors", "The people behind the films"],
            ["/watchlists", "stack", "Watchlists", "Made by members and Pheelm"],
          ] as [string, IconName, string, string][]).map(([href, icon, title, text]) => (
            <li key={href}><Link className="home-tile" href={href}><Icon name={icon} /><span><strong>{title}</strong><span>{text}</span></span></Link></li>
          ))}
        </ul>
        <ul className="chip-list home-decades" aria-label="Browse by decade">
          {decades.map((d) => <li key={d}><Link className="chip" href={`/films?decade=${d}s`}>{d}s</Link></li>)}
        </ul>
      </section>
    </section>
  );
}

/** The one suggestion at the top. */
function NextStep({ home }: { home: HomeData }) {
  if (home.next.kind === "start") {
    return (
      <section className="home-next home-start" aria-label="Start here">
        <div className="home-next-body">
          <p className="home-next-label">Start here</p>
          <h2>Make Pheelm yours</h2>
          <ol className="home-steps">
            <li className={home.following.directors ? "is-done" : undefined}><Icon name={home.following.directors ? "check" : "users2"} /><Link href="/directors">Follow directors you love</Link> to hear about their new films</li>
            <li className={home.following.watched ? "is-done" : undefined}><Icon name={home.following.watched ? "check" : "eye"} /><Link href="/films">Mark films you&rsquo;ve seen</Link> for suggestions made for you</li>
            <li><Icon name="bookmark" /><Link href="/films">Save films to your Watchlist</Link> to watch later</li>
          </ol>
        </div>
      </section>
    );
  }
  const { film } = home.next;
  const label = home.next.kind === "new" ? `New from ${home.next.director}` : "Up next on your Watchlist";
  return (
    <section className="home-next" aria-label={label} style={tintStyle(film.color)}>
      <Link className="home-next-poster" href={`/films/${film.slug}`} tabIndex={-1} aria-hidden="true">
        <Poster title={film.title} year={film.year} directors={film.directors.map((d) => d.name)} src={film.poster_url} sizes="160px" priority />
      </Link>
      <div className="home-next-body">
        <p className="home-next-label">{label}</p>
        <h2>{film.title}</h2>
        <p className="home-next-meta">{listJoin(film.directors.map((d) => d.name))} • {film.year}</p>
        {(film.note || film.synopsis) && <p className="home-next-text">{film.note || film.synopsis}</p>}
        <Link className="button" href={`/films/${film.slug}`}>See the film</Link>
      </div>
    </section>
  );
}
