/** How the Collections page can be sorted (kept apart so the page's client bar can use it). */
export type Sort = "popular" | "new" | "updated" | "films";
export const SORTS: [Sort, string][] = [["popular", "Popular"], ["new", "New"], ["updated", "Updated"], ["films", "Most films"]];

export type Feed = "all" | "featured" | "following";
export const FEEDS: { value: Feed; label: string }[] = [
  { value: "all", label: "All" },
  { value: "featured", label: "Featured" },
  { value: "following", label: "Following" },
];

/** Preserve film/search context when changing the feed or sort. */
export function collectionsHref(path: string, params: string, next: { feed: Feed; sort: Sort }) {
  const query = new URLSearchParams(params);
  if (next.feed === "all") query.delete("feed"); else query.set("feed", next.feed);
  if (next.sort === "popular") query.delete("sort"); else query.set("sort", next.sort);
  query.delete("show");
  const value = query.toString();
  return value ? `${path}?${value}` : path;
}
