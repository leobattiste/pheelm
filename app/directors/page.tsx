import type { Metadata } from "next";
import DirectorCard from "@/components/DirectorCard";
import { getDirectors } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Directors",
  description: "Black directors from around the world, with biographies and filmographies.",
};

export default async function DirectorsPage() {
  const directors = await getDirectors();
  const countries = new Set(directors.map((d) => d.country).filter(Boolean));

  return (
    <section className="page">
      <header className="page-head">
        <h1>Directors</h1>
        <p className="lead">{directors.length} filmmakers from {countries.size} countries, from the silent era to now.</p>
      </header>
      <ul className="director-grid">
        {directors.map((d) => <DirectorCard key={d.id} director={d} />)}
      </ul>
    </section>
  );
}
