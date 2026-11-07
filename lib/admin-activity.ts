import type { SupabaseClient } from "@supabase/supabase-js";

/** Best-effort audit trail: admin actions should not fail if logging is temporarily unavailable. */
export async function logAdminActivity(db: SupabaseClient, action: string, targetType: string, targetId: string | null, details = "") {
  const { data: { user } } = await db.auth.getUser();
  if (!user) return;
  const { error } = await db.from("admin_activity").insert({
    actor_id: user.id, action: action.slice(0, 80), target_type: targetType.slice(0, 60),
    target_id: targetId?.slice(0, 150) ?? null, details: details.slice(0, 500) || null,
  });
  if (error) console.error("Admin audit entry failed:", error.message);
}
