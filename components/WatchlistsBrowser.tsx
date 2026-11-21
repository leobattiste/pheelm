"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CollectionsToolbar, { type Feed } from "./CollectionsToolbar";
import CommunityTile from "./CommunityTile";
import { BackToTopButton } from "./BackToTop";
import Icon from "./Icon";
import { SORTS, shownFor, sortTiles, windowKey, type Sort, type WatchlistTile } from "@/lib/collection-sorts";
import { getBrowserClient } from "@/lib/supabase/client";
import { myIds } from "@/lib/my-rows";
import { PAGE_SIZE } from "@/lib/site";

const FEEDS: Feed[] = ["all", "featured", "following"];

/**
 * The Watchlists feed. The page itself is the same for everyone, so it's saved and prefetched like
 * Films and Directors; who's signed in, the sort, the feed and "with this film" are applied here.
 */
export default function WatchlistsBrowser({ tiles }: { tiles: WatchlistTile[] }) {
  const params = useSearchParams();
  const sort: Sort = SORTS.some(([v]) => v === params.get("sort")) ? (params.get("sort") as Sort) : "popular";
  const asked: Feed = FEEDS.includes(params.get("feed") as Feed) ? (params.get("feed") as Feed) : "all";
  const filmSlug = params.get("film");

  // undefined until known; null when signed out.
  const [saved, setSaved] = useState<Set<string> | null | undefined>(undefined);
  // A screenful at a time: thousands of tiles at once makes the page slow to draw and to scroll.
  // The count is kept against the list it belongs to, so a different sort, feed or film starts at
  // the top again without a render showing the old window first.
  const [savedWindow, setWindow] = useState({ list: "", shown: PAGE_SIZE });
  const [filmTitle, setFilmTitle] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // A read that fails or runs out of time counts as following nothing, rather than an endless blank list.
    void myIds("list_saves").then(mine => { if (live) setSaved(mine ? mine.ids : null); }, () => { if (live) setSaved(new Set()); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    setFilmTitle(null);
    const db = getBrowserClient();
    if (!filmSlug || !db) return;
    let live = true;
    void db.from("films").select("title").eq("slug", filmSlug).eq("status", "published").maybeSingle()
      .then(({ data }) => { if (live) setFilmTitle((data as { title: string } | null)?.title ?? null); });
    return () => { live = false; };
  }, [filmSlug]);

  const signedIn = !!saved;
  // Following needs a signed-in viewer; until that's known a shared link keeps its feed.
  const feed: Feed = asked === "following" && saved === null ? "all" : asked;

  const list = useMemo(() => {
    let out = sortTiles(tiles, sort);
    if (filmSlug) out = out.filter((c) => c.filmSlugs.includes(filmSlug));
    if (feed === "featured") out = out.filter((c) => c.featured);
    if (feed === "following") out = out.filter((c) => saved?.has(c.id));
    return out;
  }, [tiles, sort, filmSlug, feed, saved]);
  const loadingFollowing = feed === "following" && saved === undefined;
  const listKey = windowKey(sort, feed, filmSlug);
  const shown = shownFor(savedWindow, listKey);
  if (savedWindow.list !== listKey) setWindow({ list: listKey, shown });

  return (
    <>
      {filmSlug && <p className="lead">{filmTitle ? <>Watchlists with <Link href={`/films/${filmSlug}`}>{filmTitle}</Link>. </> : "Watchlists with this film. "}<Link href="/watchlists">See all</Link></p>}
      <CollectionsToolbar signedIn={signedIn} feed={feed} sort={sort} />
      {list.length ? (
        <>
          <ul className="collection-list">{list.slice(0, shown).map((c) => <CommunityTile key={c.id} c={c} filmCount={c.filmCount} />)}</ul>
          {shown < list.length && (
            <div className="pagination-controls">
              <button type="button" className="button ghost more" onClick={() => setWindow({ list: listKey, shown: shown + PAGE_SIZE })}>Load more</button>
              <BackToTopButton />
            </div>
          )}
        </>
      ) : loadingFollowing ? (
        <ul className="collection-list" aria-busy="true" />
      ) : (
        <div className="empty-state">
          <Icon name="stack" className="empty-icon" />
          {feed === "following" ? (
            <>
              <p>You don&rsquo;t follow any watchlists yet.</p>
              <p className="muted">Press Follow in a watchlist&rsquo;s menu to keep it here and hear when films are added.</p>
            </>
          ) : (
            <p>No watchlists {filmSlug ? "with this film " : ""}yet.</p>
          )}
          {feed !== "all" && <Link className="button ghost small" href={filmSlug ? `/watchlists?film=${filmSlug}` : "/watchlists"}>See all watchlists</Link>}
        </div>
      )}
    </>
  );
}
