import type { Metadata } from "next";
import Link from "next/link";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, MIN_FILMS, type Sort } from "@/lib/community";
import { getFilm } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = { title: "Community collections", description: "Collections of films by Black directors, made by Pheelm members." };

/** Every community collection, by popularity or newest first, optionally only those with one film. */
export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ sort?: string; film?: string }> }) {
  const sp = await searchParams;
  const sort: Sort = sp.sort === "new" ? "new" : "popular";
  const film = sp.film ? await getFilm(sp.film) : null;
  const list = await getCommunityCollections({ sort, filmId: film?.id });
  const href = (s: Sort) => `/collections/community?sort=${s}${film ? `&film=${film.slug}` : ""}`;

  return (
    <section className="page">
      <header className="page-head">
        <h1>From the community</h1>
        <p className="lead">
          {film ? <>Members&rsquo; collections with <Link href={`/films/${film.slug}`}>{film.title}</Link>.</> : "Collections made by Pheelm members."}{" "}
          Make your own from your <Link href="/me">Watchlist</Link>.
        </p>
        <nav className="profile-tabs collections-jump" aria-label="Collections">
          <Link className="chip" href="/collections">From Pheelm</Link>
          <a className="chip" aria-selected="true" href="#list">From the community</a>
        </nav>
      </header>
      <div className="section-head" id="list">
        <p className="label">{list.length} {list.length === 1 ? "collection" : "collections"}</p>
        <div className="segmented-links" role="group" aria-label="Sort">
          <Link className="chip" aria-pressed={sort === "popular"} href={href("popular")}>Popular</Link>
          <Link className="chip" aria-pressed={sort === "new"} href={href("new")}>New</Link>
        </div>
      </div>
      {list.length ? (
        <ul className="collection-list">{list.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
      ) : (
        <div className="empty-state">
          <p>No community collections {film ? "with this film " : ""}yet.</p>
          <p className="muted">Make one from your Watchlist: give it a title, add at least {MIN_FILMS} films and set it to public.</p>
        </div>
      )}
    </section>
  );
}
