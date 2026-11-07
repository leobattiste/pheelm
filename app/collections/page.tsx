import Icon from "@/components/Icon";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, MIN_FILMS, type Sort } from "@/lib/community";
import { getFilm } from "@/lib/data";

export const metadata: Metadata = { title: "Collections", description: PAGE_COPY.collections, alternates: { canonical: "/collections" } };

/**
 * Every public collection, Pheelm's and members' alike, by popularity (staff picks first) or
 * newest. With ?film=, only those that include that film.
 */
export default async function CollectionsPage({ searchParams }: { searchParams: Promise<{ sort?: string; film?: string }> }) {
  const sp = await searchParams;
  const sort: Sort = sp.sort === "new" ? "new" : "popular";
  const film = sp.film ? await getFilm(sp.film) : null;
  const list = await getCommunityCollections({ sort, filmId: film?.id });
  const href = (s: Sort) => `/collections?sort=${s}${film ? `&film=${film.slug}` : ""}`;

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Collections</h1>
        <p className="lead">
          {film ? <>Collections with <Link href={`/films/${film.slug}`}>{film.title}</Link>. <Link href="/collections">See all</Link></> : PAGE_COPY.collections}
        </p>
      </header>

      <div className="section-head">
        <p className="label">Make your own from your <Link href="/me">Watchlist</Link>.</p>
        <div className="segmented-links" role="group" aria-label="Sort">
          <Link className="chip" aria-pressed={sort === "popular"} href={href("popular")}>Popular</Link>
          <Link className="chip" aria-pressed={sort === "new"} href={href("new")}>New</Link>
        </div>
      </div>

      {list.length ? (
        <ul className="collection-list">{list.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
      ) : (
        <div className="empty-state">
          <Icon name="stack" className="empty-icon" />
          <p>No collections {film ? "with this film " : ""}yet.</p>
          <p className="muted">Make one from your Watchlist: give it a title, add at least {MIN_FILMS} films and set it to public.</p>
        </div>
      )}
    </section>
  );
}
