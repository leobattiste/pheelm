import type { Metadata } from "next";
import FilmBrowser from "@/components/FilmBrowser";
import { getFacets, getFilms, toCard } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Films",
  description: "Feature films, documentaries, shorts and animation by Black directors. Filter by decade, country, language and genre.",
};

export default async function FilmsPage() {
  const [films, facets] = await Promise.all([getFilms(), getFacets()]);
  return (
    <section className="page">
      <header className="page-head">
        <h1>Films</h1>
        <p className="lead">Features, documentaries, shorts and animation, from {films.at(-1)?.year} to {films[0]?.year}.</p>
      </header>
      <FilmBrowser films={films.map(toCard)} facets={facets} />
    </section>
  );
}
