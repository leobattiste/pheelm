/** How the Collections page can be sorted (kept apart so the page's client bar can use it). */
export type Sort = "popular" | "new" | "updated" | "films";
export const SORTS: [Sort, string][] = [["popular", "Popular"], ["new", "New"], ["updated", "Updated"], ["films", "Most films"]];

import type { CollectionTileData } from "./types";

/** What the Watchlists page needs from a collection: its tile, plus what sorting and filtering use. */
export type WatchlistTile = CollectionTileData & {
  description: string | null;
  staff_pick: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  saves: number;
  /** Slugs of every film in the list, for "watchlists with this film". */
  filmSlugs: string[];
  filmCount: number;
};

const tileOrder: Record<Sort, (a: WatchlistTile, b: WatchlistTile) => number> = {
  popular: (a, b) => Number(b.staff_pick) - Number(a.staff_pick) || b.saves - a.saves || b.created_at.localeCompare(a.created_at),
  new: (a, b) => b.created_at.localeCompare(a.created_at),
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
  films: (a, b) => b.filmCount - a.filmCount || b.saves - a.saves,
};
export const sortTiles = (tiles: WatchlistTile[], sort: Sort) => [...tiles].sort(tileOrder[sort]);
