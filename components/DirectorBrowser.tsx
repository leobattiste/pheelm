import type {ReactNode} from "react";
import CatalogSearch from './CatalogSearch';
import type { PackedEntry } from '@/lib/catalog-search';
export default function DirectorBrowser({ entries, fallback }: {
    entries: PackedEntry[]; fallback?:ReactNode;
}) {
    return <CatalogSearch entries={entries} fallback={fallback} mode="directors"/>;
}
