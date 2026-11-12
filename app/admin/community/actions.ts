"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { safeInternalPath } from "@/lib/safe-navigation";

const ID = /^[0-9a-f-]{36}$/i;
const id = (f: FormData, name = "id") => {
  const value = String(f.get(name) ?? "");
  if (!ID.test(value)) throw new Error("That no longer exists.");
  return value;
};
const back = (f: FormData) => safeInternalPath(String(f.get("back") ?? ""));

/** Removes any comment (it stays as "Comment removed" if it has replies) and closes reports about it. */
export async function removeComment(f: FormData) {
  const db = await adminClient();
  const commentId = id(f);
  const { error } = await db.rpc("remove_comment", { cid: commentId });
  if (error) throw new Error(error.message);
  await db.from("comment_reports").update({ resolved: true }).eq("comment_id", commentId);
  await logAdminActivity(db, "Removed comment", "comment", commentId);
  revalidatePath("/admin", "layout");
  const to = back(f);
  if (to) redirect(to);
}

/** Deletes a watchlist for good, with its films and comments. Owner only; admins can hide instead. */
export async function deleteWatchlist(f: FormData) {
  const db = await ownerClient();
  const listId = id(f);
  const { data: list } = await db.from("lists").select("title").eq("id", listId).maybeSingle();
  const { error, count } = await db.from("lists").delete({ count: "exact" }).eq("id", listId);
  if (error) throw new Error(error.message);
  if (!count) throw new Error("The watchlist couldn't be deleted. Run supabase/admin-community.sql in Supabase first.");
  await logAdminActivity(db, "Deleted watchlist", "collection", null, list?.title ?? "");
  revalidatePath("/admin", "layout");
  revalidatePath("/watchlists");
  redirect(back(f) ?? "/admin/community/watchlists");
}
