import type { SupabaseClient } from "@supabase/supabase-js";
import { getViewer } from "./supabase/server";

/**
 * Best-effort audit trail: admin actions should not fail if logging is temporarily unavailable, but
 * a missed entry is always reported. The admin comes from the signed session token (like
 * requireAdmin), not from a call to the sign-in service, which failed whenever it was busy and
 * used to drop the entry without a word.
 */
export async function logAdminActivity(db: SupabaseClient, action: string, targetType: string, targetId: string | null, details = "", worker = false) {
  // The internal workers use the server key and have no session: their entries have no actor.
  const user = worker ? null : await getViewer(db);
  if (!user && !worker) {
    console.error(`Admin audit entry skipped (no session): ${action.slice(0, 80)}`);
    return;
  }
  const { error } = await db.from("admin_activity").insert({
    actor_id: user?.id ?? null, action: action.slice(0, 80), target_type: targetType.slice(0, 60),
    target_id: targetId?.slice(0, 150) ?? null, details: details.slice(0, 500) || null,
  });
  if (error) console.error("Admin audit entry failed:", error.message);
}
