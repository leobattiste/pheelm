import type { SupabaseClient } from "@supabase/supabase-js";

export type CommentAuthor = { id: string; handle: string; display_name: string | null; is_private?: boolean };

export type CommentItem = {
  id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  removed_at?: string | null;
  likes: number;
  liked: boolean;
  author: CommentAuthor | null;
};

type Row = Omit<CommentItem, "likes" | "liked" | "author"> & { comment_likes: { user_id: string }[] };

/**
 * A collection's comments, oldest first, with like counts and who wrote them. Read with the
 * visitor's own session, so the collection's visibility rules apply. `available` is false until
 * supabase/comments.sql has run, and the page then leaves the section out.
 */
export async function getComments(db: SupabaseClient | null, listId: string, viewerId: string | null): Promise<{ available: boolean; comments: CommentItem[] }> {
  if (!db) return { available: false, comments: [] };
  const read = (cols: string) => db.from("list_comments").select(cols).eq("list_id", listId).order("created_at", { ascending: true }).limit(500);
  let { data, error } = await read("id, parent_id, user_id, body, created_at, edited_at, removed_at, comment_likes(user_id)");
  // Before collaboration.sql has run there's no removed_at.
  if (error) ({ data, error } = await read("id, parent_id, user_id, body, created_at, edited_at, comment_likes(user_id)"));
  if (error) return { available: false, comments: [] };
  const rows = (data ?? []) as unknown as Row[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const authors = new Map<string, CommentAuthor>();
  if (ids.length) {
    const first = await db.from("member_profiles").select("id, handle, display_name, is_private").in("id", ids);
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
