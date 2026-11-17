"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { serviceClient } from "@/lib/supabase/service";

export type MemberState = { ok: boolean; message: string } | null;
const ID = /^[0-9a-f-]{36}$/i;

/**
 * Suspends a member: they can't post, like, change watchlists or submit, and their sign-in is
 * blocked. The database decides who may suspend whom; the sign-in block follows only if it agrees.
 */
export async function suspendMember(_prev: MemberState, f: FormData): Promise<MemberState> {
  try {
    const db = await adminClient();
    const who = String(f.get("id") ?? "");
    if (!ID.test(who)) return { ok: false, message: "That member no longer exists." };
    const reason = String(f.get("reason") ?? "").trim().slice(0, 500);
    const hide = f.get("hide_watchlists") === "on";
    const { error } = await db.rpc("admin_set_suspended", { who, suspend: true, reason: reason || null, hide_watchlists: hide });
    if (error) return { ok: false, message: error.message };
    const service = serviceClient();
    const banned = service ? !(await service.auth.admin.updateUserById(who, { ban_duration: "876000h" })).error : false;
    await logAdminActivity(db, "Suspended member", "member", who, [reason, hide ? "watchlists hidden" : null].filter(Boolean).join(" · "));
    revalidatePath("/admin/members", "layout");
    return banned
      ? { ok: true, message: "Suspended. They can't sign in or post." }
      : { ok: true, message: "Suspended from posting. Their sign-in couldn't be blocked: check SUPABASE_SERVICE_ROLE_KEY in Vercel." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The member couldn't be suspended." };
  }
}

/** Lifts a suspension and lets them sign in again. */
export async function restoreMember(_prev: MemberState, f: FormData): Promise<MemberState> {
  try {
    const db = await adminClient();
    const who = String(f.get("id") ?? "");
    if (!ID.test(who)) return { ok: false, message: "That member no longer exists." };
    const { error } = await db.rpc("admin_set_suspended", { who, suspend: false });
    if (error) return { ok: false, message: error.message };
    const service = serviceClient();
    if (service) await service.auth.admin.updateUserById(who, { ban_duration: "none" });
    await logAdminActivity(db, "Restored member", "member", who);
    revalidatePath("/admin/members", "layout");
    return { ok: true, message: "Restored. Their hidden watchlists stay hidden until you show them again." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The member couldn't be restored." };
  }
}

/**
 * Deletes a member's account for good: their profile, watchlists, follows, comments and photo go with
 * it, and the database emails them that the account was deleted. Admins can delete members; only the
 * owner can delete an admin; nobody can delete the owner or themselves.
 */
export async function deleteMember(_prev: MemberState, f: FormData): Promise<MemberState> {
  try {
    const db = await adminClient();
    const who = String(f.get("id") ?? "");
    if (!ID.test(who)) return { ok: false, message: "That member no longer exists." };
    if (f.get("confirm") !== "DELETE") return { ok: false, message: "Type DELETE to confirm." };
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, message: "Sign in again." };
    if (user.id === who) return { ok: false, message: "You can't delete your own account here. Use Settings." };
    const { data: roles } = await db.from("profiles").select("id, is_admin, is_owner").in("id", [user.id, who]);
    const mine = roles?.find((r) => r.id === user.id);
    const target = roles?.find((r) => r.id === who);
    if (!target) return { ok: false, message: "That member no longer exists." };
    if (target.is_owner) return { ok: false, message: "The owner can't be deleted." };
    if (target.is_admin && !mine?.is_owner) return { ok: false, message: "Only the owner can delete an admin." };
    const service = serviceClient();
    if (!service) return { ok: false, message: "Deleting needs SUPABASE_SERVICE_ROLE_KEY in Vercel." };
    const { data: photos } = await service.storage.from("avatars").list(who, { limit: 1000 });
    if (photos?.length) await service.storage.from("avatars").remove(photos.map((p) => `${who}/${p.name}`));
    await logAdminActivity(db, "Deleted member", "member", who);
    const { error } = await service.auth.admin.deleteUser(who);
    if (error) return { ok: false, message: "The member couldn't be deleted. Try again." };
    revalidatePath("/admin/members", "layout");
    return { ok: true, message: "Member deleted. They've been emailed." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The member couldn't be deleted." };
  }
}
