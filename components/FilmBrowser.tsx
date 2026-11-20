import type {ReactNode} from "react";
import CatalogSearch from './CatalogSearch';
import type { PackedEntry } from '@/lib/catalog-search';
export default function FilmBrowser({ entries, fallback, afterSearch }: {
    entries: PackedEntry[]; fallback?:ReactNode; afterSearch?:ReactNode;
}) {
    return <CatalogSearch entries={entries} fallback={fallback} afterSearch={afterSearch} mode="films"/>;
}
