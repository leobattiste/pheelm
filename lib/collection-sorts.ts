/** How the Collections page can be sorted (kept apart so the page's client bar can use it). */
export type Sort = "popular" | "new" | "updated" | "films";
export const SORTS: [Sort, string][] = [["popular", "Popular"], ["new", "New"], ["updated", "Updated"], ["films", "Most films"]];
