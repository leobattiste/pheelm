import Link from "next/link";
import { FilmGrid } from "@/components/FilmCard";
import Poster from "@/components/Poster";
import { getArticles, getCollections, getDirectors, getFacets, getFilms, toCard } from "@/lib/data";
import { countryName, TYPE_PLURALS } from "@/lib/format";
import { SITE_TAGLINE } from "@/lib/site";
import type { FilmType } from "@/lib/types";

export const revalidate = 300;

export default async function Home() {
  const [films, directors, collections, facets, articles] = await Promise.all([
    getFilms(), getDirectors(), getCollections(), getFacets(), getArticles(),
  ]);
  const featured = films.filter((f) => f.featured);
  const picks = (featured.length >= 4 ? featured : films).slice(0, 12).map(toCard);
  const types = (["feature", "documentary", "short", "animation"] as FilmType[]).map((t) => ({
    type: t,
    count: films.filter((f) => f.type === t).length,
  }));

  return (
    <>
      <section className="home-hero">
        <h1>{SITE_TAGLINE}</h1>
        <p className="lead">
          {films.length} films by {directors.length} directors from {facets.countries.length} countries, from the silent era to now.
        </p>
        <form action="/films" className="hero-search" role="search">
          <label className="visually-hidden" htmlFor="hero-q">Search films or directors</label>
          <input id="hero-q" name="q" type="search" placeholder="Search a film or a director" />
          <button className="button" type="submit">Search</button>
        </form>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Start here</h2>
          <Link href="/films">All films</Link>
        </div>
        <FilmGrid films={picks} priority={6} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Collections</h2>
          <Link href="/collections">All collections</Link>
        </div>
        <ul className="collection-list">
          {(collections.filter((c) => c.featured).length ? collections.filter((c) => c.featured) : collections).slice(0, 3).map((c) => (
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

      <section className="section">
        <div className="section-head">
          <h2>Browse</h2>
        </div>
        <div className="browse-grid">
          <div>
            <h3 className="eyebrow">By type</h3>
            <ul className="chip-list">
              {types.filter((t) => t.count).map((t) => (
                <li key={t.type}><Link className="chip" href={`/films?type=${t.type}`}>{TYPE_PLURALS[t.type]} <span>{t.count}</span></Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="eyebrow">By decade</h3>
            <ul className="chip-list">
              {facets.decades.map(([d, n]) => (
                <li key={d}><Link className="chip" href={`/films?decade=${d}`}>{d} <span>{n}</span></Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="eyebrow">By country</h3>
            <ul className="chip-list">
              {facets.countries.slice(0, 14).map(([c, n]) => (
                <li key={c}><Link className="chip" href={`/films?country=${c}`}>{countryName(c)} <span>{n}</span></Link></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Directors</h2>
          <Link href="/directors">All directors</Link>
        </div>
        <ul className="name-cloud">
          {directors.map((d) => (
            <li key={d.id}>
              <Link href={`/directors/${d.slug}`}>{d.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      {articles.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>From the Journal</h2>
            <Link href="/journal">All stories</Link>
          </div>
          <ul className="article-list">
            {articles.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link href={`/journal/${a.slug}`}>
                  <span className="eyebrow">{a.kind}</span>
                  <span className="article-title">{a.title}</span>
                  {a.dek && <span className="article-dek">{a.dek}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
