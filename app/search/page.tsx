import "./search.css";
import UnifiedSearch from "@/components/UnifiedSearch";
import { getPublicUnifiedSearchData } from "@/lib/unified-search-data";
import { privateMetadata } from "@/lib/seo";

// Cached like the other pages so it opens instantly; a member's own data loads in the browser.
export const revalidate = 300;
export const metadata = privateMetadata("Search");

export default async function SearchPage() {
  return <section className="page unified-search-page"><h1 className="visually-hidden">Search</h1><UnifiedSearch initialData={await getPublicUnifiedSearchData()} /></section>;
}
