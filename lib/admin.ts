import { notFound, redirect } from "next/navigation";
import { getServerClient } from "./supabase/server";

/**
 * Two levels: admins look after films, people, submissions, the community and the inbox; the
 * owner can also make or remove admins, delete films and export the newsletter list.
 */
async function me(db: NonNullable<Awaited<ReturnType<typeof getServerClient>>>, id: string) {
  // A failed read gives no role, never a higher one.
  const { data, error } = await db.from("profiles").select("is_admin, is_owner").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { is_admin: !!data.is_admin, is_owner: !!data.is_owner };
}

/** For admin pages: sends visitors to sign in, and hides the page from anyone who isn't an admin. */
export async function requireAdmin(next = "/admin") {
  const db = await getServerClient();
  if (!db) notFound();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const role = await me(db, user.id);
  if (!role?.is_admin) notFound();
  return { db, user, owner: role.is_owner };
}

/** For server actions: returns the database client only when the caller is an admin. */
export async function adminClient() {
  return (await adminContext()).db;
}

/** For server actions only the owner may run. */
export async function ownerClient() {
  const { db, owner } = await adminContext();
  if (!owner) throw new Error("Only the owner can do this.");
  return db;
}

async function adminContext() {
  const db = await getServerClient();
  if (!db) throw new Error("Supabase isn't connected.");
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Sign in again.");
  const role = await me(db, user.id);
  if (!role?.is_admin) throw new Error("Only admins can do this.");
  return { db, owner: role.is_owner };
}

/** Whether the signed-in viewer is an admin, for showing admin actions on public pages. */
export async function viewerIsAdmin(db: Awaited<ReturnType<typeof getServerClient>>, userId: string | null | undefined) {
  if (!db || !userId) return false;
  return !!(await me(db, userId))?.is_admin;
}
