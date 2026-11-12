"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { STATUS_LABEL, STAGES, boxOf, type MessageStatus, type PartnershipStage } from "@/lib/inbox";

export type InboxState = { ok: boolean; message: string } | null;

const ID = /^[0-9a-f-]{36}$/i;
const id = (f: FormData) => {
  const value = String(f.get("id") ?? "");
  if (!ID.test(value)) throw new Error("That message no longer exists.");
  return value;
};
/** "j…@gmail.com": enough to recognise in the log without keeping someone's address there. */
const masked = (email: string) => email.replace(/^(.).*(@.*)$/, "$1…$2");
const refresh = (messageId?: string) => {
  revalidatePath("/admin", "layout");
  if (messageId) revalidatePath(`/admin/inbox/message/${messageId}`);
};

/** Marks a message read, done or spam, or opens it again. */
export async function setMessageStatus(f: FormData) {
  const db = await adminClient();
  const messageId = id(f);
  const status = String(f.get("status")) as MessageStatus;
  if (!(status in STATUS_LABEL)) throw new Error("Choose a status.");
  const { error } = await db.from("messages").update({ status }).eq("id", messageId);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, status === "spam" ? "Marked message as spam" : status === "done" ? "Closed message" : "Reopened message", "message", messageId);
  refresh(messageId);
}

/** Moves a partnership request along: new, in conversation, accepted, declined. */
export async function setPartnershipStage(f: FormData) {
  const db = await adminClient();
  const messageId = id(f);
  const stage = String(f.get("stage")) as PartnershipStage;
  const label = STAGES.find((s) => s.id === stage)?.label;
  if (!label) throw new Error("Choose a stage.");
  // Accepting or declining closes the conversation; moving back opens it.
  const status = stage === "accepted" || stage === "declined" ? "done" : "open";
  const { error } = await db.from("messages").update({ stage, status }).eq("id", messageId).eq("topic", "partnership");
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Moved partnership", "message", messageId, label);
  refresh(messageId);
}

/** Saves the internal notes on a message. Only admins see them. */
export async function saveNotes(_prev: InboxState, f: FormData): Promise<InboxState> {
  try {
    const db = await adminClient();
    const messageId = id(f);
    const notes = String(f.get("notes") ?? "").trim();
    if (notes.length > 10000) return { ok: false, message: "Keep notes under 10,000 characters." };
    const { error } = await db.from("messages").update({ notes: notes || null }).eq("id", messageId);
    if (error) return { ok: false, message: "Your notes couldn't be saved. Try again." };
    await logAdminActivity(db, "Updated message notes", "message", messageId);
    refresh(messageId);
    return { ok: true, message: "Notes saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Your notes couldn't be saved." };
  }
}

/** Sends a reply by email from Pheelm, keeps it with the message, and closes it if asked. */
export async function replyToMessage(_prev: InboxState, f: FormData): Promise<InboxState> {
  try {
    const db = await adminClient();
    const messageId = id(f);
    const reply = String(f.get("reply") ?? "").trim();
    const close = f.get("close") === "on";
    if (!reply) return { ok: false, message: "Write a reply first." };
    if (reply.length > 5000) return { ok: false, message: "Keep your reply under 5,000 characters." };
    const { error } = await db.rpc("email_reply_to_message", { message_id: messageId, reply, close });
    if (error) return { ok: false, message: "Your reply couldn't be sent. Try again in a moment." };
    await logAdminActivity(db, close ? "Replied and closed message" : "Replied to message", "message", messageId);
    refresh(messageId);
    return { ok: true, message: close ? "Reply sent. The message is marked as done." : "Reply sent." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Your reply couldn't be sent." };
  }
}

/** Deletes a message and its replies for good, then returns to its box. */
export async function deleteMessage(f: FormData) {
  const db = await adminClient();
  const messageId = id(f);
  const { data: message } = await db.from("messages").select("topic, email").eq("id", messageId).maybeSingle();
  const { error } = await db.from("messages").delete().eq("id", messageId);
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Deleted message", "message", null, message ? `${message.topic} from ${masked(message.email)}` : "");
  refresh();
  redirect(`/admin/inbox/${message ? boxOf(message.topic) : "contact"}?deleted=1`);
}

/** Takes someone off the newsletter list. Owner only. */
export async function removeSubscriber(f: FormData) {
  const db = await ownerClient();
  const email = String(f.get("email") ?? "").trim();
  if (!email || email.length > 254) throw new Error("Choose a subscriber.");
  const { error } = await db.rpc("admin_remove_subscriber", { address: email });
  if (error) throw new Error(error.message);
  await logAdminActivity(db, "Removed newsletter subscriber", "subscriber", null, masked(email));
  revalidatePath("/admin/inbox/newsletter");
}
