import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import DirectorBrowser from "@/components/DirectorBrowser";
import { getDirectors, toDirectorSummary } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Directors",
  description: PAGE_COPY.directors,
  alternates: { canonical: "/directors" },
};

export default async function DirectorsPage() {
  const directors = (await getDirectors()).map(toDirectorSummary);

  return (
    <section className="page">
      <header className="page-head">
        <h1>Directors</h1>
        <p className="lead">{PAGE_COPY.directors}</p>
      </header>
      <DirectorBrowser directors={directors} />
    </section>
  );
}
