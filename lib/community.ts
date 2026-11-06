import { createClient } from "@supabase/supabase-js";
import { getFilms } from "./data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import type { Film } from "./types";

/** A collection to list in the community: needs a title, this many films and a member name. */
export const MIN_FILMS = 5;

export type Member = { id: string; handle: string; display_name: string | null; is_private?: boolean; country?: string | null; bio?: string | null };

// Asks for the private setting, country and bio too, and falls back to the basic columns until profiles-private.sql has run.
const FULL = "id, handle, display_name, is_private, country, bio";
const BASIC = "id, handle, display_name";
async function members<T>(run: (cols: string) => PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> {
  const first = await run(FULL);
  if (!first.error) return first.data;
  return (await run(BASIC)).data;
}
export type CommunityCollection = {
  id: string;
  title: string;
  description: string | null;
  staff_pick: boolean;
  created_at: string;
  films: Film[];
  saves: number;
  owner: Member | null;
};

// Read as a visitor (no cookies), so these pages can be cached like the rest of the catalog.
const anon = () => (supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }) : null);

export type Row = { id: string; title: string; description: string | null; staff_pick?: boolean; created_at: string; user_id: string; list_films: { film_id: string; added_at: string }[] };

/** Joins rows with their films (newest first), owners and save counts. */
export async function enrich(rows: Row[]): Promise<CommunityCollection[]> {
  const db = anon();
  if (!db || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const [films, people, counts] = await Promise.all([
    getFilms(),
    members((cols) => db.from("member_profiles").select(cols).in("id", owners)),
    db.from("list_save_counts").select("list_id, saves").in("list_id", ids),
  ]);
  const byId = new Map(films.map((f) => [f.id, f]));
  const ownerById = new Map(((people ?? []) as unknown as Member[]).map((p) => [p.id, p]));
  const savesById = new Map(((counts.data ?? []) as { list_id: string; saves: number }[]).map((c) => [c.list_id, c.saves]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    staff_pick: !!r.staff_pick,
    created_at: r.created_at,
    films: [...r.list_films].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((x) => byId.get(x.film_id)).filter((f): f is Film => !!f),
    saves: savesById.get(r.id) ?? 0,
    owner: ownerById.get(r.user_id) ?? null,
  }));
}

export type Sort = "popular" | "new";
const order: Record<Sort, (a: CommunityCollection, b: CommunityCollection) => number> = {
  popular: (a, b) => Number(b.staff_pick) - Number(a.staff_pick) || b.saves - a.saves || b.created_at.localeCompare(a.created_at),
  new: (a, b) => b.created_at.localeCompare(a.created_at),
};

/**
 * Members' public collections that qualify for the community: a title, at least five films and a
 * member name. Staff picks lead the popular order. Optionally only those that include one film.
 */
export async function getCommunityCollections({ sort = "popular", filmId, limit }: { sort?: Sort; filmId?: string; limit?: number } = {}) {
  const db = anon();
  if (!db) return [];
  const { data, error } = await db
    .from("lists")
    .select("id, title, description, staff_pick, created_at, user_id, list_films(film_id, added_at)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return [];
  let all = (await enrich(data as Row[])).filter((c) => c.owner && c.films.length >= MIN_FILMS);
  if (filmId) all = all.filter((c) => c.films.some((f) => f.id === filmId));
  all.sort(order[sort]);
  return limit ? all.slice(0, limit) : all;
}

/** A member by their handle, with all their public collections (any size). */
export async function getMember(handle: string) {
  const db = anon();
  if (!db) return null;
  const member = (await members((cols) => db.from("member_profiles").select(cols).eq("handle", handle.toLowerCase()).maybeSingle())) as Member | null;
  if (!member) return null;
  const { data } = await db
    .from("lists")
    .select("id, title, description, staff_pick, created_at, user_id, list_films(film_id, added_at)")
    .eq("is_public", true)
    .eq("user_id", member.id)
    .order("created_at", { ascending: false });
  const collections = (await enrich((data ?? []) as Row[])).sort(order.popular);
  return { member, collections };
}

/** The owner, save count and tagged members for one collection page. */
export async function collectionExtras(listId: string, userId: string) {
  const db = anon();
  if (!db) return { owner: null, saves: 0, tagged: [] as Member[] };
  const [owner, counts, tagged] = await Promise.all([
    members((cols) => db.from("member_profiles").select(cols).eq("id", userId).maybeSingle()),
    db.from("list_save_counts").select("saves").eq("list_id", listId).maybeSingle(),
    getTagged(listId),
  ]);
  return { owner: (owner as unknown as Member | null) ?? null, saves: (counts.data as { saves: number } | null)?.saves ?? 0, tagged };
}

/** Members tagged on a public collection, in the order they were tagged. Empty until list-tags.sql has run. */
export async function getTagged(listId: string): Promise<Member[]> {
  const db = anon();
  if (!db) return [];
  const { data, error } = await db.from("list_tags").select("user_id, created_at").eq("list_id", listId).order("created_at");
  if (error || !data?.length) return [];
  const ids = (data as { user_id: string }[]).map((t) => t.user_id);
  const people = ((await members((cols) => db.from("member_profiles").select(cols).in("id", ids))) ?? []) as unknown as Member[];
  const byId = new Map(people.map((p) => [p.id, p]));
  return ids.map((id) => byId.get(id)).filter((m): m is Member => !!m);
}

/** Public collections a member has been tagged on (by someone else). */
export async function getTaggedIn(memberId: string): Promise<CommunityCollection[]> {
  const db = anon();
  if (!db) return [];
  const { data: tags, error } = await db.from("list_tags").select("list_id").eq("user_id", memberId);
  if (error || !tags?.length) return [];
  const { data } = await db
    .from("lists")
    .select("id, title, description, staff_pick, created_at, user_id, list_films(film_id, added_at)")
    .eq("is_public", true)
    .in("id", (tags as { list_id: string }[]).map((t) => t.list_id));
  return (await enrich((data ?? []) as Row[])).sort(order.popular);
}
