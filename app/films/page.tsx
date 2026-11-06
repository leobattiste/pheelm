import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import FilmBrowser from "@/components/FilmBrowser";
import { getFacets, getFilms, toCard } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Films",
  description: PAGE_COPY.films,
};

export default async function FilmsPage() {
  const [films, facets] = await Promise.all([getFilms(), getFacets()]);
  return (
    <section className="page">
      <header className="page-head">
        <h1>Films</h1>
        <p className="lead">{PAGE_COPY.films}</p>
      </header>
      <FilmBrowser films={films.map(toCard)} facets={facets} />
    </section>
  );
}
