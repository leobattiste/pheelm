"use server";

import { ALL_COUNTRIES } from "@/lib/countries";
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
  redirect(`/c/${data.id}`);
}

export async function updateCollection(form: FormData) {
  const { db } = await member();
  const id = clip(form.get("id"), 64);
  const title = clip(form.get("title"), 80);
  if (!id || !title) redirect(`/c/${id}`);
  const changes: Record<string, unknown> = {
    title,
    description: clip(form.get("description"), 500) || null,
    updated_at: new Date().toISOString(),
  };
  // Only the owner's form has the Public switch; collaborators change the words only.
  if (form.has("has_public")) changes.is_public = form.get("is_public") === "on";
  await db.from("lists").update(changes).eq("id", id);
  revalidatePath("/me");
  revalidatePath(`/c/${id}`);
  redirect(`/c/${id}`);
}

export async function deleteCollection(form: FormData) {
  const { db } = await member();
  const id = clip(form.get("id"), 64);
  // The films stay in All; only the collection goes.
  await db.from("lists").delete().eq("id", id);
  revalidatePath("/me");
  redirect("/me");
}

export type NameState = { ok: boolean; message: string; handle?: string | null } | null;

/**
 * Saves the member's profile: name, handle and, when the form includes it, whether the profile is
 * private. Handles are unique and lowercase, and a few that look official are reserved.
 */
export async function updatePublicName(_prev: NameState, form: FormData): Promise<NameState> {
  const { db, user } = await member();
  const handle = clip(form.get("handle"), 24).toLowerCase().replace(/^@/, "");
  const display_name = clip(form.get("display_name"), 60) || null;
  if (handle && !/^[a-z0-9_]{3,24}$/.test(handle)) return { ok: false, message: "Handles are 3 to 24 letters, numbers or underscores." };
  const changes: Record<string, unknown> = { handle: handle || null, display_name };
  if (form.has("has_private")) changes.is_private = form.get("is_private") === "on";
  if (form.has("bio")) changes.bio = String(form.get("bio") ?? "").trim().slice(0, 300) || null;
  if (form.has("country")) {
    const country = clip(form.get("country"), 2).toUpperCase();
    if (country && !ALL_COUNTRIES[country]) return { ok: false, message: "Choose a country from the list." };
    changes.country = country || null;
  }
  let { error } = await db.from("profiles").update(changes).eq("id", user.id);
  // Before profiles-private.sql has run, save the rest.
  if (error?.code === "42703" || error?.code === "PGRST204") {
    delete changes.is_private;
    delete changes.country;
    delete changes.bio;
    ({ error } = await db.from("profiles").update(changes).eq("id", user.id));
  }
  if (error?.code === "23505") return { ok: false, message: `@${handle} is taken. Try another.` };
  if (error?.code === "23514") return { ok: false, message: `@${handle} isn't available. Try another.` };
  if (error) return { ok: false, message: "That didn't save. Try again." };
  revalidatePath("/me");
  if (handle) revalidatePath(`/@${handle}`);
  return { ok: true, message: "Saved.", handle: handle || null };
}

