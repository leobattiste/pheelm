import CatalogListing from "@/components/CatalogListing";
import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import { filterVocabulary, packFilm } from "@/lib/search-data";
import FilmBrowser from "@/components/FilmBrowser";
import { getFilms } from "@/lib/data";

export const revalidate = 3600; // admin saves refresh it right away
export const metadata: Metadata = publicPageMetadata("/films");

export default async function FilmsPage() {
  const films = await getFilms();
  const vocab = filterVocabulary(films);
  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Films</h1>
        <p className="lead">{PAGE_COPY.films}</p>
      </header>
      <FilmBrowser entries={films.map((f) => packFilm(f, vocab))} fallback={<CatalogListing mode="films" films={films}/>} />
    </section>
  );
}
