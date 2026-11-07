"use server";

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
  const { error } = await db.rpc("delete_my_account");
  if (error) return { ok: false, message: "Your account couldn't be deleted from here. Contact us and we'll do it for you." };
  await db.auth.signOut();
  redirect("/?deleted=1");
}
