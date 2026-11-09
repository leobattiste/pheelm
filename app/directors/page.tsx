import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import { directorSearchEntry } from "@/lib/search-data";
import DirectorBrowser from "@/components/DirectorBrowser";
import { getDirectors } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Directors",
  description: PAGE_COPY.directors,
  alternates: { canonical: "/directors" },
};

export default async function DirectorsPage() {
  const directors = (await getDirectors()).map(directorSearchEntry);

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Directors</h1>
        <p className="lead">{PAGE_COPY.directors}</p>
      </header>
      <DirectorBrowser entries={directors} />
    </section>
  );
}
