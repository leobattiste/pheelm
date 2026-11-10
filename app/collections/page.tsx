import Icon from "@/components/Icon";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import CollectionsToolbar, { type Feed } from "@/components/CollectionsToolbar";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, SORTS, type Sort } from "@/lib/community";
import { getFilm } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Watchlists", description: PAGE_COPY.collections, alternates: { canonical: "/collections" } };

const FEEDS: Feed[] = ["all", "featured", "following"];

/**
 * Every public collection, as a feed: All, Featured (staff picks and the ones admins feature) or
 * Following. Sorted by popularity, newest, last updated or most films. With ?film=, only those
 * that include that film.
 */
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ sort?: string; film?: string; feed?: string }> }) {
  const sp = await searchParams;
  const sort: Sort = SORTS.some(([v]) => v === sp.sort) ? (sp.sort as Sort) : "popular";
  const db = await getServerClient();
  const viewer = db ? (await db.auth.getUser()).data.user : null;
  const asked: Feed = FEEDS.includes(sp.feed as Feed) ? (sp.feed as Feed) : "all";
  const feed: Feed = asked === "following" && !viewer ? "all" : asked;

  const film = sp.film ? await getFilm(sp.film) : null;
  let list = await getCommunityCollections({ sort, filmId: film?.id });

  if (feed === "featured") list = list.filter((c) => c.featured);
  if (db && viewer && feed === "following") {
    const { data } = await db.from("list_saves").select("list_id").eq("user_id", viewer.id);
    const ids = new Set(((data ?? []) as { list_id: string }[]).map((r) => r.list_id));
    list = list.filter((c) => ids.has(c.id));
  }

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Watchlists</h1>
        <p className="lead">
          {film ? <>Watchlists with <Link href={`/films/${film.slug}`}>{film.title}</Link>. <Link href="/collections">See all</Link></> : PAGE_COPY.collections}
        </p>
      </header>

      <CollectionsToolbar signedIn={!!viewer} feed={feed} sort={sort} />

      {list.length ? (
        <ul className="collection-list">{list.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
      ) : (
        <div className="empty-state">
          <Icon name="stack" className="empty-icon" />
          {feed === "following" ? (
            <>
              <p>You don&rsquo;t follow any watchlists yet.</p>
              <p className="muted">Press Follow in a collection&rsquo;s menu to keep it here and hear when films are added.</p>
            </>
          ) : (
            <p>No watchlists {film ? "with this film " : ""}yet.</p>
          )}
          {feed !== "all" && <Link className="button ghost small" href={film ? `/collections?film=${film.slug}` : "/collections"}>See all watchlists</Link>}
        </div>
      )}
    </section>
  );
}
