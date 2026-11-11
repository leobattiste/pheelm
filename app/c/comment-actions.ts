"use server";

import { moderateAndApprove } from "@/lib/moderation";
import { getServerClient } from "@/lib/supabase/server";

export type CommentWriteResult =
  | { ok: true; comment: { id: string; parent_id: string | null; user_id: string; body: string; created_at: string; edited_at: string | null } }
  | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function signedIn() {
  const db = await getServerClient();
  if (!db) return null;
  const { data: { user } } = await db.auth.getUser();
  return user ? { db, user } : null;
}

export async function postModeratedComment(input: {
  listId: string; parentId: string | null; body: string;
}): Promise<CommentWriteResult> {
  const session = await signedIn();
  if (!session) return { ok: false, message: "Sign in to comment." };
  if (!UUID.test(input.listId) || (input.parentId !== null && !UUID.test(input.parentId)))
    return { ok: false, message: "This collection couldn't be found." };
  const body = String(input.body ?? "").trim();
  if (!body || body.length > 1000) return { ok: false, message: "Comments must be between 1 and 1,000 characters." };

  const moderation = await moderateAndApprove("comment", body, session.user.id);
  if (!moderation.ok) return moderation;

  // Existing RLS, block rules, rate limits and the reply-depth trigger still apply.
  const { data, error } = await session.db.from("list_comments")
    .insert({ list_id: input.listId, parent_id: input.parentId, user_id: session.user.id, body })
    .select("id, parent_id, user_id, body, created_at, edited_at").single();

  if (error || !data) return { ok: false, message: error?.message?.includes("very fast")
    ? "You're commenting very fast. Wait a minute and try again."
    : "That didn't go through. Please try again." };
  return { ok: true, comment: data };
}

export async function editModeratedComment(input: { id: string; body: string }): Promise<CommentWriteResult> {
  const session = await signedIn();
  if (!session) return { ok: false, message: "Sign in to edit this comment." };
  if (!UUID.test(input.id)) return { ok: false, message: "Comment not found." };
  const body = String(input.body ?? "").trim();
  if (!body || body.length > 1000) return { ok: false, message: "Comments must be between 1 and 1,000 characters." };

  const { data: previous, error: readError } = await session.db.from("list_comments")
    .select("id, list_id, parent_id, user_id, body, created_at, edited_at")
    .eq("id", input.id).maybeSingle();
  if (readError || !previous || previous.user_id !== session.user.id)
    return { ok: false, message: "You can only edit your own comments." };
  if (previous.body === body) return { ok: true, comment: previous };
  
  const moderation = await moderateAndApprove("comment", body, session.user.id);
  if (!moderation.ok) return moderation;

  const { data, error } = await session.db.from("list_comments").update({ body })
    .eq("id", input.id).eq("user_id", session.user.id)
    .select("id, parent_id, user_id, body, created_at, edited_at").single();

  if (error || !data) return { ok: false, message: "Your comment couldn't be updated. Please try again." };
  return { ok: true, comment: data };
}
