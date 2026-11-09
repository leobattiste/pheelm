import CatalogSearch from './CatalogSearch';
import type { SearchEntry } from '@/lib/catalog-search';
export default function DirectorBrowser({ entries }: {
    entries: SearchEntry[];
}) {
    return <CatalogSearch entries={entries} mode="directors"/>;
}
