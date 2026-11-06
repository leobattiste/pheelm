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

export type TagState = { ok: boolean; message: string } | null;

/** Tags a member (by @handle) on one of your public collections. */
export async function tagMember(_prev: TagState, form: FormData): Promise<TagState> {
  const { db, user } = await member();
  const listId = clip(form.get("list_id"), 64);
  const handle = clip(form.get("handle"), 25).toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return { ok: false, message: "Enter a handle, like @maya." };
  const { data: person } = await db.from("member_profiles").select("id").eq("handle", handle).maybeSingle();
  if (!person) return { ok: false, message: `There's no public profile at @${handle}.` };
  if (person.id === user.id) return { ok: false, message: "That's you. Tag someone else." };
  const { error } = await db.from("list_tags").insert({ list_id: listId, user_id: person.id });
  if (error?.code === "23505") return { ok: false, message: `@${handle} is already tagged.` };
  if (error?.code === "23514") return { ok: false, message: "A collection can tag up to 10 people." };
  if (error?.code === "42P01" || error?.code === "PGRST205") return { ok: false, message: "Tagging isn't switched on yet." };
  if (error) return { ok: false, message: `Couldn't tag @${handle}. Their profile may be private, or the collection isn't public.` };
  revalidatePath("/me");
  revalidatePath(`/c/${listId}`);
  return { ok: true, message: `Tagged @${handle}.` };
}

/** Removes a tag: the collection's owner removing someone, or a member removing themselves. */
export async function untagMember(form: FormData) {
  const { db, user } = await member();
  const listId = clip(form.get("list_id"), 64);
  const userId = clip(form.get("user_id"), 64) || user.id;
  await db.from("list_tags").delete().eq("list_id", listId).eq("user_id", userId);
  revalidatePath("/me");
  revalidatePath(`/c/${listId}`);
  const back = clip(form.get("back"), 200);
  if (back.startsWith("/")) redirect(back);
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

