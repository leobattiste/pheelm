import "./search.css";
import UnifiedSearch from "@/components/UnifiedSearch";
import { getUnifiedSearchData } from "@/lib/unified-search-data";
import { privateMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata = privateMetadata("Search");

export default async function SearchPage() {
  return <section className="page unified-search-page"><header className="page-head intro-head"><h1>Search</h1><p className="lead">Find films, directors, watchlists and members, or browse what’s new.</p></header><UnifiedSearch initialData={await getUnifiedSearchData()} /></section>;
}
