import { createClient } from "@supabase/supabase-js";
import { getFilms } from "./data";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseEnabled } from "./supabase/config";
import type { Film } from "./types";
import type { Sort } from "./collection-sorts";

/** A collection to list in the community: needs a title, this many films and a member name. */
export const MIN_FILMS = 5;

export type Member = { id: string; handle: string; display_name: string | null; is_private?: boolean; country?: string | null; bio?: string | null; avatar_url?: string | null; social_platform?: string | null; social_url?: string | null; website_url?: string | null };

// Asks for the private setting, country and bio too, and falls back to the basic columns until profiles-private.sql has run.
const FULL = "id, handle, display_name, is_private, country, bio, avatar_url, social_platform, social_url, website_url";
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
  /** Featured by an admin (staff picks are featured too). */
  featured: boolean;
  created_at: string;
  /** The last change: an edit, or the newest film added. */
  updated_at: string;
  films: Film[];
  /** Used to rank "Popular"; never shown. */
  saves: number;
  owner: Member | null;
  /** How many co-curators work on it with the owner. */
  curators: number;
};

// Read as a visitor (no cookies), so these pages can be cached like the rest of the catalog.
const anon = () => (supabaseEnabled ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }) : null);

export type Row = { id: string; title: string; description: string | null; staff_pick?: boolean; featured?: boolean; created_at: string; updated_at?: string | null; user_id: string; list_films: { film_id: string; added_at: string }[] };

const ROW_COLS = "id, title, description, staff_pick, featured, created_at, updated_at, user_id, list_films(film_id, added_at)";
const ROW_COLS_BASIC = "id, title, description, staff_pick, created_at, updated_at, user_id, list_films(film_id, added_at)";
/** Runs a lists query, without the featured column until admins-watched-blocks.sql has run. */
async function lists(run: (cols: string) => PromiseLike<{ data: unknown; error: unknown }>) {
  const first = await run(ROW_COLS);
  return first.error ? run(ROW_COLS_BASIC) : first;
}

/** Joins rows with their films (newest first), owners and save counts. */
export async function enrich(rows: Row[]): Promise<CommunityCollection[]> {
  const db = anon();
  if (!db || !rows.length) return [];
  const ids = rows.map((r) => r.id);
  const owners = [...new Set(rows.map((r) => r.user_id))];
  const [films, people, counts, crew] = await Promise.all([
    getFilms(),
    members((cols) => db.from("member_profiles").select(cols).in("id", owners)),
    db.from("list_save_counts").select("list_id, saves").in("list_id", ids),
    db.from("list_members").select("list_id").eq("status", "active").in("list_id", ids),
  ]);
  const crewById = new Map<string, number>();
  for (const r of (crew.data ?? []) as { list_id: string }[]) crewById.set(r.list_id, (crewById.get(r.list_id) ?? 0) + 1);
  const byId = new Map(films.map((f) => [f.id, f]));
  const ownerById = new Map(((people ?? []) as unknown as Member[]).map((p) => [p.id, p]));
  const savesById = new Map(((counts.data ?? []) as { list_id: string; saves: number }[]).map((c) => [c.list_id, c.saves]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    staff_pick: !!r.staff_pick,
    featured: !!r.staff_pick || !!r.featured,
    created_at: r.created_at,
    updated_at: [r.updated_at ?? r.created_at, ...r.list_films.map((x) => x.added_at)].sort().at(-1)!,
    // Staff collections in year order (their covers show where they begin); members' newest first.
    films: [...r.list_films]
      .sort((a, b) => r.staff_pick ? (byId.get(a.film_id)?.year ?? 0) - (byId.get(b.film_id)?.year ?? 0) : b.added_at.localeCompare(a.added_at))
      .map((x) => byId.get(x.film_id)).filter((f): f is Film => !!f),
    saves: savesById.get(r.id) ?? 0,
    owner: ownerById.get(r.user_id) ?? null,
    curators: crewById.get(r.id) ?? 0,
  }));
}

export { SORTS, type Sort } from "./collection-sorts";
const order: Record<Sort, (a: CommunityCollection, b: CommunityCollection) => number> = {
  popular: (a, b) => Number(b.staff_pick) - Number(a.staff_pick) || b.saves - a.saves || b.created_at.localeCompare(a.created_at),
  new: (a, b) => b.created_at.localeCompare(a.created_at),
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
  films: (a, b) => b.films.length - a.films.length || b.saves - a.saves,
};

/**
 * Every qualifying collection, read once and shared for half a minute by every page this server
 * renders (they're public, and the same for everyone), instead of on every visit.
 */
const FRESH_FOR = 30_000;
let shared: { at: number; data: Promise<CommunityCollection[]> } | null = null;
function qualifying() {
  if (shared && Date.now() - shared.at < FRESH_FOR) return shared.data;
  const data = (async () => {
    const db = anon();
    if (!db) return [];
    const { data, error } = await lists((cols) => db
      .from("lists")
      .select(cols)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(1000));
    if (error) throw error;
    // Staff picks always show; other collections need a member name and at least five films.
    return (await enrich(data as unknown as Row[])).filter((c) => c.owner && (c.staff_pick || c.films.length >= MIN_FILMS));
  })();
  shared = { at: Date.now(), data };
  // A failed read isn't kept, so the next visit tries again.
  return data.catch(() => { if (shared?.data === data) shared = null; return [] as CommunityCollection[]; });
}

/**
 * Every public collection that qualifies for the Collections page: a title, a member name, and at
 * least five films (staff picks always qualify). Staff picks lead the popular order. Optionally
 * only those that include one film.
 */
export async function getCommunityCollections({ sort = "popular", filmId, limit }: { sort?: Sort; filmId?: string; limit?: number } = {}) {
  let all = [...(await qualifying())];
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
  const { data } = await lists((cols) => db
    .from("lists")
    .select(cols)
    .eq("is_public", true)
    .eq("user_id", member.id)
    .order("created_at", { ascending: false }));
  const collections = (await enrich((data ?? []) as unknown as Row[])).sort(order.popular);
  return { member, collections };
}

/** The owner and save count for one collection page. */
export async function collectionExtras(listId: string, userId: string) {
  const db = anon();
  if (!db) return { owner: null, saves: 0 };
  const [owner, counts] = await Promise.all([
    members((cols) => db.from("member_profiles").select(cols).eq("id", userId).maybeSingle()),
    db.from("list_save_counts").select("saves").eq("list_id", listId).maybeSingle(),
  ]);
  return { owner: (owner as unknown as Member | null) ?? null, saves: (counts.data as { saves: number } | null)?.saves ?? 0 };
}

/** Public collections a member collaborates on (not their own). Empty until collaboration.sql has run. */
export async function getCollaboratingOn(memberId: string): Promise<CommunityCollection[]> {
  const db = anon();
  if (!db) return [];
  const { data: rows, error } = await db.from("list_members").select("list_id").eq("user_id", memberId).eq("status", "active");
  if (error || !rows?.length) return [];
  const { data } = await lists((cols) => db
    .from("lists")
    .select(cols)
    .eq("is_public", true)
    .in("id", (rows as { list_id: string }[]).map((r) => r.list_id)));
  return (await enrich((data ?? []) as unknown as Row[])).sort(order.popular);
}

/** The collection that used to live at /collections/<slug>, before Pheelm's own moved into @leo's. */
export async function collectionIdForLegacySlug(slug: string) {
  const db = anon();
  if (!db) return null;
  const { data } = await db.from("lists").select("id").eq("legacy_slug", slug).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Anonymous reads include only profiles whose owners have made them public. */
export async function getPublicProfileHandles():Promise<string[]> {
 const db=anon();if(!db)return [];
 const handles:string[]=[];
 for(let from=0;;from+=1000){
  const {data,error}=await db.from('member_profiles').select('handle').eq('is_private',false).order('handle').range(from,from+999);
  if(error)return [];
  for(const row of data??[])if(/^[a-z0-9_]{3,24}$/.test(row.handle))handles.push(row.handle);
  if(!data || data.length<1000)return handles;
 }
}
