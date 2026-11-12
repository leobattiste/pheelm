import type { SupabaseClient } from "@supabase/supabase-js";

export type CommentAuthor = { id: string; handle: string; display_name: string | null; is_private?: boolean; avatar_url?: string | null };

/** What a conversation is about: a member's watchlist or a film. */
export type CommentTarget = { list: string } | { film: string };

export type CommentItem = {
  id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  removed_at?: string | null;
  spoiler?: boolean;
  likes: number;
  liked: boolean;
  author: CommentAuthor | null;
};

type Row = Omit<CommentItem, "likes" | "liked" | "author"> & { comment_likes: { user_id: string }[] };

/** The column a target's comments are stored under, and its id. */
export const targetColumn = (t: CommentTarget): ["list_id" | "film_id", string] => ("film" in t ? ["film_id", t.film] : ["list_id", t.list]);

/**
 * A watchlist's or film's comments, oldest first, with like counts and who wrote them. Read with
 * the visitor's own session, so the watchlist's or film's visibility rules apply. `available` is
 * false until the comments tables are set up (for films, supabase/film-comments.sql), and the page
 * then leaves the section out.
 */
export async function getComments(db: SupabaseClient | null, target: CommentTarget | string, viewerId: string | null): Promise<{ available: boolean; comments: CommentItem[] }> {
  if (!db) return { available: false, comments: [] };
  const [column, id] = targetColumn(typeof target === "string" ? { list: target } : target);
  const read = (cols: string) => db.from("list_comments").select(cols).eq(column, id).order("created_at", { ascending: true }).limit(500);
  let { data, error } = await read("id, parent_id, user_id, body, created_at, edited_at, removed_at, spoiler, comment_likes(user_id)");
  // Before film-comments.sql has run there's no spoiler column (and no film comments at all).
  if (error && column === "list_id") ({ data, error } = await read("id, parent_id, user_id, body, created_at, edited_at, removed_at, comment_likes(user_id)"));
  // Before collaboration.sql has run there's no removed_at.
  if (error && column === "list_id") ({ data, error } = await read("id, parent_id, user_id, body, created_at, edited_at, comment_likes(user_id)"));
  if (error) return { available: false, comments: [] };
  let rows = (data ?? []) as unknown as Row[];
  // Comments from people the viewer blocked, and replies to them, aren't shown to the viewer.
  if (viewerId) {
    const { data: blocks } = await db.from("blocks").select("blocked_id").eq("blocker_id", viewerId);
    const blocked = new Set(((blocks ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id));
    if (blocked.size) {
      const gone = new Set(rows.filter((r) => blocked.has(r.user_id)).map((r) => r.id));
      rows = rows.filter((r) => !gone.has(r.id) && !(r.parent_id && gone.has(r.parent_id)));
    }
  }
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const authors = new Map<string, CommentAuthor>();
  if (ids.length) {
    const first = await db.from("member_profiles").select("id, handle, display_name, is_private, avatar_url").in("id", ids);
    const people = first.error ? (await db.from("member_profiles").select("id, handle, display_name").in("id", ids)).data : first.data;
    for (const p of (people ?? []) as CommentAuthor[]) authors.set(p.id, p);
  }
  return {
    available: true,
    comments: rows.map(({ comment_likes, ...r }) => ({
      ...r,
      likes: comment_likes.length,
      liked: !!viewerId && comment_likes.some((l) => l.user_id === viewerId),
      author: authors.get(r.user_id) ?? null,
    })),
  };
}

/**
 * Which of these members have marked the film watched. Read with the visitor's session, so
 * members who keep their watched films private never show up.
 */
export async function watchedBy(db: SupabaseClient | null, filmId: string, userIds: string[]): Promise<string[]> {
  if (!db || !userIds.length) return [];
  const { data, error } = await db.from("watched").select("user_id").eq("film_id", filmId).in("user_id", userIds);
  return error ? [] : ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** Where a comment lives, as a link to it on the site (for admin pages and activity). */
export function commentPlace(c: { id: string; list_id: string | null; film_id?: string | null; lists?: { title: string } | null; films?: { title: string; slug: string } | null }) {
  return c.film_id
    ? { href: `/films/${c.films?.slug ?? ""}#comment-${c.id}`, title: c.films?.title ?? "a film", kind: "Film" }
    : { href: `/c/${c.list_id}#comment-${c.id}`, title: c.lists?.title ?? "a watchlist", kind: "Watchlist" };
}
