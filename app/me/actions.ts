"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);

/** The signed-in member's database client. Row-level security keeps every change to their own rows. */
async function member() {
  const db = await getServerClient();
  if (!db) throw new Error("Accounts aren't connected.");
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login?next=/me");
  return { db, user };
}

export async function createCollection(form: FormData) {
  const { db, user } = await member();
  const title = clip(form.get("title"), 80);
  if (!title) redirect("/me");
  const { data, error } = await db.from("lists").insert({ user_id: user.id, title }).select("id").single();
  if (error || !data) redirect("/me?error=collection");
  revalidatePath("/me");
  redirect(`/me?c=${data.id}`);
}

export async function updateCollection(form: FormData) {
  const { db } = await member();
  const id = clip(form.get("id"), 64);
  const title = clip(form.get("title"), 80);
  if (!id || !title) redirect(`/me?c=${id}`);
  await db
    .from("lists")
    .update({
      title,
      description: clip(form.get("description"), 500) || null,
      is_public: form.get("is_public") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  revalidatePath("/me");
  revalidatePath(`/c/${id}`);
  redirect(`/me?c=${id}`);
}

export async function deleteCollection(form: FormData) {
  const { db } = await member();
  const id = clip(form.get("id"), 64);
  // The films stay in All; only the collection goes.
  await db.from("lists").delete().eq("id", id);
  revalidatePath("/me");
  redirect("/me");
}

export type NameState = { ok: boolean; message: string } | null;

/** Saves the member's public name and handle. Handles are unique and lowercase. */
export async function updatePublicName(_prev: NameState, form: FormData): Promise<NameState> {
  const { db, user } = await member();
  const handle = clip(form.get("handle"), 24).toLowerCase().replace(/^@/, "");
  const display_name = clip(form.get("display_name"), 60) || null;
  if (handle && !/^[a-z0-9_]{3,24}$/.test(handle)) return { ok: false, message: "Handles are 3 to 24 letters, numbers or underscores." };
  const { error } = await db.from("profiles").update({ handle: handle || null, display_name }).eq("id", user.id);
  if (error?.code === "23505") return { ok: false, message: `@${handle} is taken. Try another.` };
  if (error) return { ok: false, message: "That didn't save. Try again." };
  revalidatePath("/me");
  return { ok: true, message: handle ? `Saved. Your page is pheelm.com/@${handle}.` : "Saved." };
}
