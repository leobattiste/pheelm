import CatalogListing from "@/components/CatalogListing";
import { publicPageMetadata } from "@/lib/seo";
import { PAGE_COPY } from "@/lib/site";
import type { Metadata } from "next";
import { directorSearchEntry } from "@/lib/search-data";
import DirectorBrowser from "@/components/DirectorBrowser";
import { getDirectors } from "@/lib/data";

export const revalidate = 300;
export const metadata: Metadata = publicPageMetadata("/directors");

export default async function DirectorsPage() {
  const all=await getDirectors();
  const directors = all.map(directorSearchEntry);

  return (
    <section className="page">
      <header className="page-head intro-head">
        <h1>Directors</h1>
        <p className="lead">{PAGE_COPY.directors}</p>
      </header>
      <DirectorBrowser entries={directors} fallback={<CatalogListing mode="directors" directors={all}/>} />
    </section>
  );
}
