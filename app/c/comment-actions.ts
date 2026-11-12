"use server";

import { bannedWordError, checkText } from "@/lib/moderation";
import { getServerClient } from "@/lib/supabase/server";

type Written = { id: string; parent_id: string | null; user_id: string; body: string; created_at: string; edited_at: string | null; spoiler?: boolean };
export type CommentWriteResult =
  | { ok: true; comment: Written }
  | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedIn() {
  const db = await getServerClient();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  return user ? { db, user } : null;
}

// Film comments have a spoiler mark; it's left out for watchlists and before film-comments.sql has run.
const COLUMNS = "id, parent_id, user_id, body, created_at, edited_at";

/** Posts a comment on a watchlist (listId) or a film (filmId), after the banned-word check. */
export async function postModeratedComment(input: {
  listId?: string; filmId?: string; parentId: string | null; body: string; spoiler?: boolean;
}): Promise<CommentWriteResult> {
  const session = await signedIn();
  if (!session) return { ok: false, message: "Sign in to comment." };
  const film = typeof input.filmId === "string";
  const targetId = film ? input.filmId! : input.listId;
  if (!targetId || !UUID.test(targetId) || (film && input.listId) || (input.parentId !== null && !UUID.test(input.parentId)))
    return { ok: false, message: film ? "This film couldn't be found." : "This collection couldn't be found." };
  const body = String(input.body ?? "").trim();
  if (!body || body.length > 1000) return { ok: false, message: "Comments must be between 1 and 1,000 characters." };

  const moderation = await checkText("comment", body);
  if (!moderation.ok) return moderation;

  // Existing RLS, block rules, rate limits and the reply-depth trigger still apply.
  const row: Record<string, unknown> = film
    ? { film_id: targetId, parent_id: input.parentId, user_id: session.user.id, body, spoiler: input.spoiler === true }
    : { list_id: targetId, parent_id: input.parentId, user_id: session.user.id, body };
  const { data, error } = await session.db.from("list_comments").insert(row)
    .select(film ? `${COLUMNS}, spoiler` : COLUMNS).single<Written>();

  if (bannedWordError(error)) return { ok: false, message: bannedWordError(error)! };
  if (error || !data) return { ok: false, message: error?.message?.includes("very fast")
    ? "You're commenting very fast. Wait a minute and try again."
    : "That didn't go through. Please try again." };
  return { ok: true, comment: data };
}

/** Edits your own comment's text (and, on a film, its spoiler mark), after the banned-word check. */
export async function editModeratedComment(input: { id: string; body: string; spoiler?: boolean }): Promise<CommentWriteResult> {
  const session = await signedIn();
  if (!session) return { ok: false, message: "Sign in to edit this comment." };
  if (!UUID.test(input.id)) return { ok: false, message: "Comment not found." };
  const body = String(input.body ?? "").trim();
  if (!body || body.length > 1000) return { ok: false, message: "Comments must be between 1 and 1,000 characters." };

  const film = typeof input.spoiler === "boolean";
  const columns = film ? `${COLUMNS}, spoiler` : COLUMNS;
  const { data: previous, error: readError } = await session.db.from("list_comments")
    .select(columns).eq("id", input.id).maybeSingle<Written>();
  if (readError || !previous || previous.user_id !== session.user.id)
    return { ok: false, message: "You can only edit your own comments." };
  const spoilerChanged = film && previous.spoiler !== input.spoiler;
  if (previous.body === body && !spoilerChanged) return { ok: true, comment: previous };

  // Only new text needs checking; flipping the spoiler mark doesn't.
  if (previous.body !== body) {
    const moderation = await checkText("comment", body);
    if (!moderation.ok) return moderation;
  }

  const { data, error } = await session.db.from("list_comments").update(film ? { body, spoiler: input.spoiler } : { body })
    .eq("id", input.id).eq("user_id", session.user.id)
    .select(columns).single<Written>();

  if (bannedWordError(error)) return { ok: false, message: bannedWordError(error)! };
  if (error || !data) return { ok: false, message: "Your comment couldn't be updated. Please try again." };
  return { ok: true, comment: data };
}
