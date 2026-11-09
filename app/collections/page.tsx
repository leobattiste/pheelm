import Icon from "@/components/Icon";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import CollectionsToolbar from "@/components/CollectionsToolbar";
import { notFound } from "next/navigation";
import { collectionsHref, type Feed } from "@/lib/collection-sorts";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, getFollowedCollections, SORTS, type Sort, type CommunityCollection } from "@/lib/community";
import { getFilm } from "@/lib/data";
import { getServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Collections", description: PAGE_COPY.collections, alternates: { canonical: "/collections" } };

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
  if (sp.film && !film) notFound();
  let list: CommunityCollection[] = [];
  let loadFailed = false;
  try {
    list = feed === "following" && db && viewer
      ? await getFollowedCollections(db, viewer.id, { sort, filmId: film?.id })
      : await getCommunityCollections({ sort, filmId: film?.id, strict: true });
    if (feed === "featured") list = list.filter((collection) => collection.featured);
  } catch { loadFailed = true; }
  const retryHref = collectionsHref("/collections", film ? new URLSearchParams({ film: film.slug }).toString() : "", { feed, sort });

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Collections</h1>
        <p className="lead">
          {film ? <>Collections with <Link href={`/films/${film.slug}`}>{film.title}</Link>. <Link href="/collections">See all</Link></> : PAGE_COPY.collections}
        </p>
      </header>

      <CollectionsToolbar signedIn={!!viewer} feed={feed} sort={sort} />

      {loadFailed ? (
        <p className="notice error" role="alert">Collections couldn&rsquo;t be loaded. <Link href={retryHref}>Try again</Link>.</p>
      ) : list.length ? (
        <ul className="collection-list">{list.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
      ) : (
        <div className="empty-state">
          <Icon name="stack" className="empty-icon" />
          {feed === "following" ? (
            <>
              <p>{film ? "No followed collections include this film yet." : "You don’t follow any public collections yet."}</p>
              <p className="muted">Press Follow in a collection&rsquo;s menu to keep it here and hear when films are added.</p>
            </>
          ) : (
            <p>No {feed === "featured" ? "featured " : ""}collections {film ? "with this film " : ""}yet.</p>
          )}
          {feed !== "all" && <Link className="button ghost small" href={film ? `/collections?film=${film.slug}` : "/collections"}>See all collections</Link>}
        </div>
      )}
    </section>
  );
}
