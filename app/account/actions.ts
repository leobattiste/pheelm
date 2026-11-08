"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

export type DeleteState = { ok: boolean; message: string } | null;

/**
 * Deletes the signed-in member's account: their profile, Watchlist, collections, follows,
 * comments and notifications go with it (supabase/account-settings.sql).
 */
export async function deleteAccount(_prev: DeleteState, f: FormData): Promise<DeleteState> {
  if (f.get("confirm") !== "DELETE") return { ok: false, message: "Type DELETE to confirm." };
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Accounts aren't available right now." };
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in again, then try." };
  const { data: photos, error: photoListError } = await db.storage.from("avatars").list(user.id, { limit: 1000 });
  if (photoListError) return { ok: false, message: "Your profile photo couldn't be removed. Try again." };
  if (photos?.length) {
    const { error } = await db.storage.from("avatars").remove(photos.map(photo => `${user.id}/${photo.name}`));
    if (error) return { ok: false, message: "Your profile photo couldn't be removed. Try again." };
  }
  const { error } = await db.rpc("delete_my_account");
  if (error) return { ok: false, message: "Your account couldn't be deleted from here. Contact us and we'll do it for you." };
  await db.auth.signOut();
  redirect("/?deleted=1");
}

export type PrivacyState = { ok: boolean; message: string } | null;

/** Settings → Privacy: a private profile, and hiding Watched or Following on a public one. */
export async function updatePrivacy(_prev: PrivacyState, f: FormData): Promise<PrivacyState> {
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Accounts aren't connected." };
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");
  const changes = {
    is_private: f.get("is_private") === "on",
    hide_watched: f.get("hide_watched") === "on",
    hide_following: f.get("hide_following") === "on",
  };
  const { error } = await db.from("profiles").update(changes).eq("id", user.id);
  if (error) return { ok: false, message: "That didn't save. Try again." };
  revalidatePath("/account");
  return { ok: true, message: "Saved." };
}

/** Unblocks someone from Settings → Privacy. */
export async function unblock(f: FormData) {
  const db = await getServerClient();
  if (!db) return;
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/account");
  await db.from("blocks").delete().eq("blocker_id", user.id).eq("blocked_id", String(f.get("id")));
  revalidatePath("/account");
}
