"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { collabMessage } from "@/lib/collab";
import { getServerClient } from "@/lib/supabase/server";

export type CollabState = { ok: boolean; message: string } | null;

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? "").trim().slice(0, max);
const uuid = (v: FormDataEntryValue | null) => {
  const s = clip(v, 64);
  return /^[0-9a-f-]{36}$/i.test(s) ? s : "";
};

/** The signed-in member's client. The database functions check who may do what. */
async function signedIn(next: string) {
  const db = await getServerClient();
  if (!db) throw new Error("Accounts aren't connected.");
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return db;
}

const refresh = (listId: string) => {
  revalidatePath(`/c/${listId}`);
  revalidatePath("/me");
  revalidatePath("/notifications");
};

/** The owner invites someone by @handle. */
export async function inviteCollaborator(_prev: CollabState, form: FormData): Promise<CollabState> {
  const listId = uuid(form.get("list_id"));
  const handle = clip(form.get("handle"), 25).replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(handle)) return { ok: false, message: "Enter a handle, like @maya." };
  const db = await signedIn(`/c/${listId}`);
  const { data, error } = await db.rpc("invite_collaborator", { lid: listId, who: handle });
  if (error) return { ok: false, message: collabMessage(error) };
  refresh(listId);
  return { ok: true, message: data === "active" ? `@${handle} had asked to join, so they're in.` : `Invited @${handle}. They'll see it in their notifications.` };
}

/** A member asks to collaborate, with an optional note for the owner. */
export async function requestCollaboration(_prev: CollabState, form: FormData): Promise<CollabState> {
  const listId = uuid(form.get("list_id"));
  const db = await signedIn(`/c/${listId}`);
  const { error } = await db.rpc("request_collaboration", { lid: listId, message: clip(form.get("note"), 280) || null });
  if (error) return { ok: false, message: collabMessage(error) };
  refresh(listId);
  return { ok: true, message: "Request sent. You'll get a notification when the owner answers." };
}

/** Accept or decline an invite (from the collection page or the notifications page). */
export async function respondToInvite(form: FormData) {
  const listId = uuid(form.get("list_id"));
  const db = await signedIn(`/c/${listId}`);
  await db.rpc("respond_to_invite", { lid: listId, accept: form.get("accept") === "1" });
  refresh(listId);
  const back = clip(form.get("back"), 200);
  if (back.startsWith("/")) redirect(back);
}

/** The owner approves or declines a request. */
export async function respondToRequest(form: FormData) {
  const listId = uuid(form.get("list_id"));
  const db = await signedIn(`/c/${listId}`);
  await db.rpc("respond_to_request", { lid: listId, who: uuid(form.get("user_id")), accept: form.get("accept") === "1" });
  refresh(listId);
  const back = clip(form.get("back"), 200);
  if (back.startsWith("/")) redirect(back);
}

/** The owner removes someone or cancels an invite; anyone leaves or withdraws their request. */
export async function removeCollaborator(form: FormData) {
  const listId = uuid(form.get("list_id"));
  const db = await signedIn(`/c/${listId}`);
  const who = uuid(form.get("user_id"));
  await db.rpc("remove_collaborator", who ? { lid: listId, who } : { lid: listId });
  refresh(listId);
  const back = clip(form.get("back"), 200);
  if (back.startsWith("/")) redirect(back);
}
