import { notFound, redirect } from "next/navigation";
import { getServerClient } from "./supabase/server";

/** For admin pages: sends visitors to sign in, and hides the page from anyone who isn't an admin. */
export async function requireAdmin(next = "/admin") {
  const db = await getServerClient();
  if (!db) notFound();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) notFound();
  return { db, user };
}

/** For server actions: returns the database client only when the caller is an admin. */
export async function adminClient() {
  const db = await getServerClient();
  if (!db) throw new Error("Supabase isn't connected.");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  const { data: me } = await db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) throw new Error("Only admins can do this.");
  return db;
}
