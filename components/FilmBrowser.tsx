import CatalogSearch from './CatalogSearch';
import type { SearchEntry } from '@/lib/catalog-search';
export default function FilmBrowser({ entries }: {
    entries: SearchEntry[];
}) {
    return <CatalogSearch entries={entries} mode="films"/>;
}
