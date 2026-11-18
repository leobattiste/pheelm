import "server-only";
import { weeklyPopular } from "./search-discovery";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFilms, getDirectors } from "./data";
import { filmSearchEntry, directorSearchEntry } from "./search-data";
import { getServerClient } from "./supabase/server";
import type { Film } from "./types";
import type { UnifiedSearchData, SearchWatchlist, SearchMember } from "./unified-search";

type PublicMember = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  bio: string | null;
  is_private: boolean;
};
type ListOwner = Pick<PublicMember, "id" | "handle" | "display_name">;
type ListRow = {
  id: string;
  slug?: string | null;
  title: string;
  description: string | null;
  is_public: boolean;
  hidden: boolean;
  user_id: string;
  featured?: boolean;
  staff_pick: boolean;
  created_at: string;
  updated_at: string | null;
  list_films: { film_id: string; added_at: string }[];
};
const MEMBER_COLUMNS = "id,handle,display_name,avatar_url,country,bio,is_private";
const LIST_COLUMNS = "id,slug,title,description,is_public,hidden,user_id,featured,staff_pick,created_at,updated_at,list_films(film_id,added_at)";

/** RLS remains active. These reads use only the requesting member's ordinary session. */
async function rows<T>(db: SupabaseClient, table: string, columns: string, filter: (query: any) => any, order = "id"): Promise<T[]> {
  const all: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await filter(db.from(table).select(columns)).order(order).range(start, start + 999);
    // Optional social tables may not have been installed yet. Never widen a privacy filter
    // to work around a missing column, table or denied query.
    if (error) return [];
    all.push(...(data ?? []) as T[]);
    if (!data || data.length < 1000) return all;
  }
}

function watchlist(row: ListRow, films: Map<string, Film>, owners: Map<string, ListOwner>): SearchWatchlist {
  const owner = owners.get(row.user_id);
  const entries = [...(row.list_films ?? [])].sort((a, b) => row.staff_pick
    ? (films.get(a.film_id)?.year ?? 0) - (films.get(b.film_id)?.year ?? 0)
    : b.added_at.localeCompare(a.added_at));
  const visible = entries.flatMap(entry => films.has(entry.film_id) ? [films.get(entry.film_id)!] : []);
  const uniqueFilms = [...new Map(visible.map(film => [film.id, film])).values()];
  const publicOwner = owner ? { id: owner.id, handle: owner.handle, display_name: owner.display_name } : null;
  return {
    id: row.id,
    slug: row.slug ?? undefined,
    title: row.title,
    description: row.description,
    is_public: row.is_public,
    featured: !!row.featured || !!row.staff_pick,
    staff_pick: !!row.staff_pick,
    owner: publicOwner,
    filmIds: uniqueFilms.map(film => film.id),
    tile: {
      id: row.id,
      slug: row.slug ?? undefined,
      title: row.title,
      owner: publicOwner,
      films: uniqueFilms.slice(0, 3).map(film => ({ id: film.id, title: film.title, year: film.year, poster_url: film.poster_url, color: film.color, directors: film.directors.map(director => ({ name: director.name })) })),
    },
    created_at: row.created_at,
    updated_at: [row.updated_at ?? row.created_at, ...entries.map(entry => entry.added_at)].sort().at(-1) ?? row.created_at,
    // Kept for compatibility with collection DTOs; unified search neither displays nor ranks
    // by saves, so it doesn't fan out additional count queries for every visible watchlist.
    saves: 0,
  };
}

/**
 * Public catalog plus request-private social data. Do not put this function in a module cache:
 * social relationships must never survive into another viewer's response. Explicit public
 * predicates also constrain admins' broader RLS access.
 */
export async function getUnifiedSearchData(): Promise<UnifiedSearchData> {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const viewerId = user?.id ?? null;
  const [catalog, directors, publicLists, profiles, ownProfiles, following, followers, followedDirectors] = await Promise.all([
    getFilms(),
    getDirectors(),
    db ? rows<ListRow>(db, "lists", LIST_COLUMNS, query => query.eq("is_public", true).eq("hidden", false)) : [],
    db ? rows<PublicMember>(db, "member_profiles", MEMBER_COLUMNS, query => query.eq("is_private", false)) : [],
    db && viewerId ? rows<ListOwner>(db, "profiles", "id,handle,display_name", query => query.eq("id", viewerId)) : [],
    db && viewerId ? rows<{ followed_id: string }>(db, "member_follows", "followed_id", query => query.eq("follower_id", viewerId), "followed_id") : [],
    db && viewerId ? rows<{ follower_id: string }>(db, "member_follows", "follower_id", query => query.eq("followed_id", viewerId), "follower_id") : [],
    db && viewerId ? rows<{ person_id: string }>(db, "follows", "person_id", query => query.eq("user_id", viewerId), "person_id") : [],
  ]);
  const published = catalog.filter(film => film.status === "published");
  const filmById = new Map(published.map(film => [film.id, film]));
  const publicMembers = profiles.filter(profile => profile.is_private === false && typeof profile.handle === "string" && /^[a-z0-9_]{3,24}$/i.test(profile.handle));
  const memberById = new Map<string, ListOwner>(publicMembers.map(profile => [profile.id, profile]));
  // A private viewer still sees their own curator label. This minimal own-profile read is
  // used only for list ownership; it never adds a private member to directory results.
  const ownProfile = ownProfiles.find(profile => profile.id === viewerId && typeof profile.handle === "string" && /^[a-z0-9_]{3,24}$/i.test(profile.handle));
  if (ownProfile) memberById.set(ownProfile.id, { id: ownProfile.id, handle: ownProfile.handle, display_name: ownProfile.display_name });
  const followingIds = new Set(following.map(row => row.followed_id));
  const followerIds = new Set(followers.map(row => row.follower_id));
  // Defense in depth: even if a privileged session can see collaborator/admin-only records,
  // those are not part of search. Only public lists qualify.
  const visibleLists = [...new Map(publicLists
    .filter(list => list.hidden === false && list.is_public === true)
    .map(list => [list.id, list])).values()];
  const members: SearchMember[] = publicMembers.map(profile => ({
    id: profile.id,
    handle: profile.handle,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    country: profile.country,
    bio: profile.bio,
    following: followingIds.has(profile.id),
    followsYou: followerIds.has(profile.id),
  }));
  const visibleDirectors = directors.map(director => ({ ...director, films: director.films.filter(film => filmById.has(film.id)) }))
    .filter(director => director.in_directory !== false && director.films.length > 0);
  return {
    popularFilmIds: weeklyPopular(published).map(film=>film.id),
    followedDirectorIds: followedDirectors.map(row=>row.person_id),
    films: published.map(film=>({...filmSearchEntry(film),added:Date.parse(film.published_at??film.created_at??"")||0})),
    directors: visibleDirectors.map(director => ({
      ...directorSearchEntry(director),
      genres: [...new Set(director.films.flatMap(film => film.genres))],
      languages: [...new Set(director.films.flatMap(film => film.languages))],
      filmography: director.films.filter(film => film.status === "published").map(film => ({ year: film.year, type: film.type, genres: film.genres, countries: film.countries, languages: film.languages })),
    })),
    watchlists: visibleLists.map(list => watchlist(list, filmById, memberById)),
    members,
    viewerId,
    signedIn: !!viewerId,
  };
}
