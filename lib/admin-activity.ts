import type { SupabaseClient } from "@supabase/supabase-js";
import type { Change } from "@/lib/changes";

/**
 * Best-effort audit trail: admin actions should not fail if logging is temporarily unavailable.
 * `changes` records what an edit changed, field by field, shown in the activity log and on the record.
 */
export async function logAdminActivity(db: SupabaseClient, action: string, targetType: string, targetId: string | null, details = "", changes?: Change[]) {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const entry: Record<string, unknown> = {
    actor_id: user.id, action: action.slice(0, 80), target_type: targetType.slice(0, 60),
    target_id: targetId?.slice(0, 150) ?? null, details: details.slice(0, 500) || null,
  };
  let { error } = await db.from("admin_activity").insert(changes?.length ? { ...entry, changes: changes.slice(0, 40) } : entry);
  // Before the changes column exists, keep the entry without them.
  if (error && changes?.length && /changes/.test(error.message)) ({ error } = await db.from("admin_activity").insert(entry));
  if (error) console.error("Admin audit entry failed:", error.message);
}
