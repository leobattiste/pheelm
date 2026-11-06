"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

async function me() {
  const db = await getServerClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  return db && user ? { db, user } : null;
}

/** Marks everything read, except invites and requests still waiting for an answer. */
export async function markAllRead() {
  const s = await me();
  if (!s) return;
  await s.db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", s.user.id).is("read_at", null).not("type", "in", "(invite,request)");
  revalidatePath("/notifications");
}

/** Deletes notifications already read. */
export async function clearRead() {
  const s = await me();
  if (!s) return;
  await s.db.from("notifications").delete().eq("user_id", s.user.id).not("read_at", "is", null);
  revalidatePath("/notifications");
}
