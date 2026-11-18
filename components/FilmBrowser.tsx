import type {ReactNode} from "react";
import CatalogSearch from './CatalogSearch';
import type { SearchEntry } from '@/lib/catalog-search';
export default function FilmBrowser({ entries, fallback, afterSearch }: {
    entries: SearchEntry[]; fallback?:ReactNode; afterSearch?:ReactNode;
}) {
    return <CatalogSearch entries={entries} fallback={fallback} afterSearch={afterSearch} mode="films"/>;
}
