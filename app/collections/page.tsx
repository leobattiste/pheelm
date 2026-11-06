import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";
import CollectionTile from "@/components/CollectionTile";
import CommunityTile from "@/components/CommunityTile";
import { getCommunityCollections, MIN_FILMS } from "@/lib/community";
import { getCollections, getFacets } from "@/lib/data";
import { countryName } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Collections",
  description: PAGE_COPY.collections,
};

const KIND_ORDER = ["movement", "theme", "country", "genre", "decade"] as const;
const KIND_LABELS: Record<string, string> = {
  movement: "Movements", theme: "Themes", country: "Countries and regions", genre: "Forms", decade: "Decades",
};

export default async function CollectionsPage() {
  const [collections, facets, community] = await Promise.all([getCollections(), getFacets(), getCommunityCollections({ limit: 6 })]);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Collections</h1>
        <p className="lead">{PAGE_COPY.collections}</p>
        <nav className="profile-tabs collections-jump" aria-label="Collections">
          <a className="chip" aria-selected="true" href="#from-pheelm">From Pheelm</a>
          <Link className="chip" href="/collections/community">From the community</Link>
        </nav>
      </header>

      <h2 className="visually-hidden" id="from-pheelm">From Pheelm</h2>

      {KIND_ORDER.map((kind) => {
        const list = collections.filter((c) => c.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="collection-group">
            <h3>{KIND_LABELS[kind]}</h3>
            <ul className="collection-list">
              {list.map((c) => <CollectionTile key={c.id} collection={c} />)}
            </ul>
          </section>
        );
      })}

      <section className="collection-group community-part" aria-labelledby="from-community">
        <div className="section-head">
          <h2 className="collections-part" id="from-community">From the community</h2>
          <Link className="button ghost small" href="/collections/community">See all</Link>
        </div>
        <p className="muted community-intro">
          Collections made by members. Make your own from your <Link href="/me">Watchlist</Link>: give it a title, add at least {MIN_FILMS} films and make it public.
        </p>
        {community.length ? (
          <ul className="collection-list">{community.map((c) => <CommunityTile key={c.id} c={c} />)}</ul>
        ) : (
          <div className="empty-state"><p>No community collections yet.</p><p className="muted">Be the first: make one from your Watchlist and set it to public.</p></div>
        )}
      </section>

      <section className="collection-group">
        <h3>Every country</h3>
        <ul className="chip-list">
          {[...facets.countries].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))).map(([c, n]) => (
            <li key={c}><Link className="chip" href={`/films?country=${c}`}>{countryName(c)} <span className="count">{n}</span></Link></li>
          ))}
        </ul>
      </section>
    </section>
  );
}
