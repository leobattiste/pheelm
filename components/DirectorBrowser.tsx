import type {ReactNode} from "react";
import CatalogSearch from './CatalogSearch';
import type { SearchEntry } from '@/lib/catalog-search';
export default function DirectorBrowser({ entries, fallback }: {
    entries: SearchEntry[]; fallback?:ReactNode;
}) {
    return <CatalogSearch entries={entries} fallback={fallback} mode="directors"/>;
}
