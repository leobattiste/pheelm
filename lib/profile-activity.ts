import type { SupabaseClient } from "@supabase/supabase-js";
import { commentPlace } from "./comments";
import { watchlistPath } from "./watchlist-links";

/** One thing a member did, as a sentence with a link: "Commented on Atlantics". */
export type Activity = { id: string; verb: string; title: string; href: string; at: string };

const LIMIT = 20;
type Title = { title: string; slug: string } | null;

/**
 * A member's latest public activity: watchlists they made, comments, films they watched and
 * directors they followed, newest first. Read with the visitor's own session, so private
 * watchlists, hidden watched films and private following never show up for anyone else.
 * Anything that fails to load is left out rather than failing the whole list.
 */
export async function getProfileActivity(db: SupabaseClient | null, memberId: string): Promise<Activity[]> {
  if (!db) return [];
  const [lists, comments, watched, follows] = await Promise.all([
    db.from("lists").select("id, slug, title, created_at").eq("user_id", memberId).eq("is_public", true).eq("hidden", false)
      .order("created_at", { ascending: false }).limit(LIMIT),
    db.from("list_comments").select("id, list_id, film_id, created_at, lists(title), films(title, slug)").eq("user_id", memberId).is("removed_at", null)
      .order("created_at", { ascending: false }).limit(LIMIT),
    db.from("watched").select("film_id, watched_at, films(title, slug)").eq("user_id", memberId)
      .order("watched_at", { ascending: false }).limit(LIMIT),
    db.from("follows").select("person_id, created_at, people(name, slug, in_directory)").eq("user_id", memberId)
      .order("created_at", { ascending: false }).limit(LIMIT),
  ]);
  const items: Activity[] = [];
  for (const l of (lists.error ? [] : lists.data ?? []) as { id: string; slug: string | null; title: string; created_at: string }[])
    items.push({ id: `list-${l.id}`, verb: "Created", title: l.title, href: watchlistPath(l), at: l.created_at });
  for (const c of (comments.error ? [] : comments.data ?? []) as unknown as { id: string; list_id: string | null; film_id: string | null; created_at: string; lists: { title: string } | null; films: Title }[]) {
    // A comment on a watchlist or film the visitor can't see comes back without it.
    if (c.film_id ? !c.films : !c.lists) continue;
    const place = commentPlace(c);
    items.push({ id: `comment-${c.id}`, verb: "Commented on", title: place.title, href: place.href, at: c.created_at });
  }
  for (const w of (watched.error ? [] : watched.data ?? []) as unknown as { film_id: string; watched_at: string; films: Title }[])
    if (w.films) items.push({ id: `watched-${w.film_id}`, verb: "Watched", title: w.films.title, href: `/films/${w.films.slug}`, at: w.watched_at });
  for (const f of (follows.error ? [] : follows.data ?? []) as unknown as { person_id: string; created_at: string; people: { name: string; slug: string; in_directory: boolean | null } | null }[])
    if (f.people) items.push({ id: `follow-${f.person_id}`, verb: "Followed", title: f.people.name, href: `/${f.people.in_directory === false ? "people" : "directors"}/${f.people.slug}`, at: f.created_at });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, LIMIT);
}
