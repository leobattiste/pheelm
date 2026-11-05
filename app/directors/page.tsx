import type { Metadata } from "next";
import DirectorBrowser from "@/components/DirectorBrowser";
import { getDirectors, toDirectorSummary } from "@/lib/data";
import { MAP_HEIGHT, MAP_WIDTH, worldMap } from "@/lib/worldmap";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Directors",
  description: "Black directors from around the world, with biographies and filmographies. Filter by country and era, or explore them on a map.",
};

export default async function DirectorsPage() {
  const directors = (await getDirectors()).map(toDirectorSummary);
  const countries = new Set(directors.map((d) => d.country).filter(Boolean));

  return (
    <section className="page">
      <header className="page-head">
        <h1>Directors</h1>
        <p className="lead">{directors.length} filmmakers from {countries.size} countries, from the silent era to now.</p>
      </header>
      <DirectorBrowser directors={directors} map={worldMap()} mapWidth={MAP_WIDTH} mapHeight={MAP_HEIGHT} />
    </section>
  );
}
