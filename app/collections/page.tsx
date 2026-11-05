import type { Metadata } from "next";
import Link from "next/link";
import Poster from "@/components/Poster";
import { getCollections, getFacets } from "@/lib/data";
import { countryName } from "@/lib/format";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Collections",
  description: "Curated selections of films by Black directors, by movement, theme, country, decade and genre.",
};

const KIND_ORDER = ["movement", "theme", "country", "genre", "decade"] as const;
const KIND_LABELS: Record<string, string> = {
  movement: "Movements", theme: "Themes", country: "Countries and regions", genre: "Genres", decade: "Decades",
};

export default async function CollectionsPage() {
  const [collections, facets] = await Promise.all([getCollections(), getFacets()]);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Collections</h1>
        <p className="lead">Curated selections by movement, theme, country, decade and genre.</p>
      </header>

      {KIND_ORDER.map((kind) => {
        const list = collections.filter((c) => c.kind === kind);
        if (!list.length) return null;
        return (
          <section key={kind} className="section">
            <h2 className="eyebrow">{KIND_LABELS[kind]}</h2>
            <ul className="collection-list">
              {list.map((c) => (
                <li key={c.id}>
                  <Link href={`/collections/${c.slug}`} className="collection-tile">
                    <span className="collection-stack" aria-hidden="true">
                      {c.films.slice(0, 3).map((f) => (
                        <Poster key={f.id} title={f.title} year={f.year} directors={f.directors.map((d) => d.name)} src={f.poster_url} />
                      ))}
                    </span>
                    <span className="collection-title">{c.title}</span>
                    <span className="collection-meta">{c.films.length} films</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="section">
        <h2 className="eyebrow">Every country</h2>
        <ul className="chip-list">
          {[...facets.countries].sort((a, b) => countryName(a[0]).localeCompare(countryName(b[0]))).map(([c, n]) => (
            <li key={c}><Link className="chip" href={`/films?country=${c}`}>{countryName(c)} <span>{n}</span></Link></li>
          ))}
        </ul>
      </section>
      <section className="section">
        <h2 className="eyebrow">Every decade</h2>
        <ul className="chip-list">
          {facets.decades.map(([d, n]) => (
            <li key={d}><Link className="chip" href={`/films?decade=${d}`}>{d} <span>{n}</span></Link></li>
          ))}
        </ul>
      </section>
    </section>
  );
}
