import "./search.css";
import UnifiedSearch from "@/components/UnifiedSearch";
import { getUnifiedSearchData } from "@/lib/unified-search-data";
import { privateMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = privateMetadata("Search");

export default async function SearchPage() {
  return <section className="page unified-search-page"><h1>Search</h1><UnifiedSearch initialData={await getUnifiedSearchData()} /></section>;
}
