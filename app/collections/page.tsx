import type { Metadata } from "next";
import Link from "next/link";
import CollectionTile from "@/components/CollectionTile";
import { getCollections, getFacets } from "@/lib/data";
import { countryName } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Collections",
  description: "Films by Black directors grouped by movement, theme, country and form, from the L.A. Rebellion to new African cinema.",
};

const KIND_ORDER = ["movement", "theme", "country", "genre", "decade"] as const;
const KIND_LABELS: Record<string, string> = {
  movement: "Movements", theme: "Themes", country: "Countries and regions", genre: "Forms", decade: "Decades",
};

export default async function CollectionsPage() {
  const [collections, facets] = await Promise.all([getCollections(), getFacets()]);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Collections</h1>
        <p className="lead">Films grouped by movement, theme, country and form.</p>
      </header>

      {KIND_ORDER.map((kind) => {
        const list = collections.filter((c) => c.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="collection-group">
            <h2>{KIND_LABELS[kind]}</h2>
            <ul className="collection-list">
              {list.map((c) => <CollectionTile key={c.id} collection={c} />)}
            </ul>
          </section>
        );
      })}

      <section className="collection-group">
        <h2>Every country</h2>
        <ul className="chip-list">
          {[...facets.countries].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))).map(([c, n]) => (
            <li key={c}><Link className="chip" href={`/films?country=${c}`}>{countryName(c)} <span className="count">{n}</span></Link></li>
          ))}
        </ul>
      </section>
    </section>
  );
}
