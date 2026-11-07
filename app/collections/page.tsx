import Icon from "@/components/Icon";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import CollectionsToolbar, { type Feed, type Show } from "@/components/CollectionsToolbar";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, type CommunityCollection, type Sort } from "@/lib/community";
import { getFilm } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Collections", description: PAGE_COPY.collections, alternates: { canonical: "/collections" } };

const SHOWS: Show[] = ["all", "staff", "community"];
const FEEDS: Feed[] = ["all", "for-you", "following"];

/** Collections that share films with what you've saved or with directors you follow, most in common first. */
function forYou(list: CommunityCollection[], viewerId: string, saved: Set<string>, directors: Set<string>) {
  const score = (c: CommunityCollection) => c.films.reduce((n, f) => n + (saved.has(f.id) ? 2 : 0) + (f.directors.some((d) => directors.has(d.id)) ? 1 : 0), 0);
  return list
    .filter((c) => c.owner?.id !== viewerId)
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);
}

/**
 * Every public collection, staff picks and the community's, as a feed: All, For you (sharing films
 * with your Watchlist and directors you follow) or Following. Filters sort them and narrow them to
 * staff picks or the community's.
 * With ?film=, only those that include that film.
 */
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ sort?: string; film?: string; show?: string; feed?: string }> }) {
  const sp = await searchParams;
  const sort: Sort = sp.sort === "new" ? "new" : "popular";
  const db = await getServerClient();
  const viewer = db ? (await db.auth.getUser()).data.user : null;
  const show: Show = SHOWS.includes(sp.show as Show) ? (sp.show as Show) : "all";
  const feed: Feed = viewer && FEEDS.includes(sp.feed as Feed) ? (sp.feed as Feed) : "all";

  const film = sp.film ? await getFilm(sp.film) : null;
  let list = await getCommunityCollections({ sort, filmId: film?.id });

  if (show === "staff") list = list.filter((c) => c.staff_pick);
  if (show === "community") list = list.filter((c) => !c.staff_pick);
  if (db && viewer && feed === "following") {
    const { data } = await db.from("list_saves").select("list_id").eq("user_id", viewer.id);
    const ids = new Set(((data ?? []) as { list_id: string }[]).map((r) => r.list_id));
    list = list.filter((c) => ids.has(c.id));
  }
  if (db && viewer && feed === "for-you") {
    const [saved, follows] = await Promise.all([
      db.from("watchlist").select("film_id").eq("user_id", viewer.id),
      db.from("follows").select("person_id").eq("user_id", viewer.id),
    ]);
    list = forYou(
      list,
      viewer.id,
      new Set(((saved.data ?? []) as { film_id: string }[]).map((r) => r.film_id)),
      new Set(((follows.data ?? []) as { person_id: string }[]).map((r) => r.person_id)),
    );
  }

  const empty = {
    following: { title: "You don't follow any collections yet.", body: "Press Follow on a collection to keep it here and hear when films are added." },
    "for-you": { title: "Nothing picked for you yet.", body: "Save films to your Watchlist and follow directors, and collections that share them will show here." },
  } as Record<Feed, { title: string; body: string } | undefined>;

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Collections</h1>
        <p className="lead">
          {film ? <>Collections with <Link href={`/films/${film.slug}`}>{film.title}</Link>. <Link href="/collections">See all</Link></> : PAGE_COPY.collections}
        </p>
      </header>

      <CollectionsToolbar signedIn={!!viewer} feed={feed} show={show} sort={sort} />

      {list.length ? (
        <ul className="collection-list">{list.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
      ) : (
        <div className="empty-state">
          <Icon name="stack" className="empty-icon" />
          <p>{empty[feed]?.title ?? `No collections ${film ? "with this film " : ""}yet.`}</p>
          <p className="muted">{empty[feed]?.body ?? "Check back soon, or start one of your own."}</p>
          {(show !== "all" || feed !== "all") && <Link className="button ghost small" href={film ? `/collections?film=${film.slug}` : "/collections"}>See all collections</Link>}
        </div>
      )}
    </section>
  );
}
