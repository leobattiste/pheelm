import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY, PAGE_SIZE } from "@/lib/site";
import type { Metadata } from "next";
import { Suspense } from "react";
import CommunityTile from "@/components/CommunityTile";
import { ToolbarSkeleton } from "@/components/Skeletons";
import WatchlistsBrowser from "@/components/WatchlistsBrowser";
import { getWatchlistTiles } from "@/lib/community";
import { sortTiles } from "@/lib/collection-sorts";

export const revalidate = 300; // admin saves refresh it right away
export const metadata: Metadata = publicPageMetadata("/watchlists");

/**
 * Every public collection, as a feed: All, Featured (staff picks and the ones admins feature) or
 * Following, sorted by popularity, newest, last updated or most films. The page is the same for
 * everyone (so it's saved and prefetched like Films and Directors); the feed, sort, "with this
 * film" and who's signed in are applied in the browser.
 */
export default async function CollectionsPage() {
  const tiles = await getWatchlistTiles();
  const first = sortTiles(tiles, "popular").slice(0, PAGE_SIZE);
  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Watchlists</h1>
        <p className="lead">{PAGE_COPY.collections}</p>
      </header>
      <Suspense fallback={<>
        <ToolbarSkeleton />
        <ul className="collection-list">{first.map((c) => <CommunityTile key={c.id} c={c} filmCount={c.filmCount} />)}</ul>
      </>}>
        <WatchlistsBrowser tiles={tiles} />
      </Suspense>
    </section>
  );
}
