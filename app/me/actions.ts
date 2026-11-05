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
