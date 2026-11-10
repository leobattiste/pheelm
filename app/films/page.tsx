import CatalogListing from "@/components/CatalogListing";
import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import { filmSearchEntry } from "@/lib/search-data";
import FilmBrowser from "@/components/FilmBrowser";
import { getFilms } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = publicPageMetadata("/films");

export default async function FilmsPage() {
  const films = await getFilms();
  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Films</h1>
        <p className="lead">{PAGE_COPY.films}</p>
      </header>
      <FilmBrowser entries={films.map(filmSearchEntry)} fallback={<CatalogListing mode="films" films={films}/>} />
    </section>
  );
}
