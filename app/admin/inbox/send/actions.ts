"use server";

import { revalidatePath } from "next/cache";
import { adminClient, ownerClient } from "@/lib/admin";
import { logAdminActivity } from "@/lib/admin-activity";
import { KINDS, type Draft, type Reach, type SendResult } from "./shared";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "https://www.pheelm.com/films?x" or "pheelm.com/films" become "/films?x"; other sites are refused by the database. */
function pathOf(link: string) {
  const value = link.trim();
  if (!value) return "/";
  const site = value.match(/^(?:https?:\/\/)?(?:www\.)?pheelm\.com(\/[^\s]*)?$/i);
  if (site) return site[1] || "/";
  return value;
}

function args(d: Draft) {
  if (!KINDS.some((k) => k.id === d.kind)) throw new Error("Choose what kind of message this is.");
  const ref = d.audience === "members" || d.audience === "subscribers" ? null : d.ref;
  if (ref && !UUID.test(ref)) throw new Error("Choose the director, film or member again.");
  const channels = d.kind === "newsletter" ? ["email"] : (["in_app", "email"] as const).filter((c) => d.channels.includes(c));
  return { p_kind: d.kind, p_audience: d.kind === "newsletter" ? "subscribers" : d.audience, p_ref: ref, p_channels: channels };
}

/** Database messages are written for people; anything else becomes a plain retry note. */
function failure(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "42501") return error.message?.startsWith("Only the owner") ? "Only the owner can send messages." : "Only admins can do this.";
  if (error.code === "P0001" && error.message) return error.message.endsWith(".") ? error.message : error.message + ".";
  return fallback;
}

/** How many people a draft reaches right now, by each channel. */
export async function previewReach(d: Draft): Promise<Reach> {
  try {
    const db = await adminClient();
    const { data, error } = await db.rpc("admin_campaign_preview", args(d));
    if (error) return { ok: false, message: failure(error, "Couldn't count who gets this. Try again.") };
    const r = data as { audience: number; recipients: number; in_app: number; emails: number };
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't count who gets this." };
  }
}

/** Sends the draft to the signed-in admin only, as recipients will see it. */
export async function sendTest(d: Draft): Promise<SendResult> {
  try {
    const db = await adminClient();
    const { data, error } = await db.rpc("admin_campaign_test", {
      p_kind: d.kind, p_subject: d.subject, p_message: d.message, p_action_path: pathOf(d.link), p_action_label: d.label,
    });
    if (error) return { ok: false, message: failure(error, "The test couldn't be sent. Try again.") };
    await logAdminActivity(db, "Sent a test message", "campaign", null, d.subject.trim());
    return { ok: true, message: `Test sent to ${data}. It arrives within about 5 minutes.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "The test couldn't be sent." };
  }
}

/** Sends it to everyone it reaches. `expected` is the count the owner confirmed. */
export async function sendCampaign(d: Draft, expected: number): Promise<SendResult> {
  try {
    const db = await ownerClient();
    const a = args(d);
    const { data, error } = await db.rpc("admin_campaign_send", {
      p_kind: a.p_kind, p_subject: d.subject, p_message: d.message, p_action_path: pathOf(d.link), p_action_label: d.label,
      p_audience: a.p_audience, p_ref: a.p_ref, p_channels: a.p_channels, p_expected: expected,
    });
    if (error) return { ok: false, message: failure(error, "It couldn't be sent. Nothing went out. Try again.") };
    const r = data as { id: string; in_app: number; emails: number };
    await logAdminActivity(db, `Sent ${KINDS.find((k) => k.id === d.kind)?.label.toLowerCase() ?? "message"}`, "campaign", r.id,
      `${d.subject.trim()} · ${r.in_app} in-app, ${r.emails} emails`);
    revalidatePath("/admin/inbox/send");
    const parts = [r.in_app ? `${r.in_app} in-app` : "", r.emails ? `${r.emails} ${r.emails === 1 ? "email" : "emails"}` : ""].filter(Boolean).join(" and ");
    return { ok: true, message: `Sent: ${parts}.${r.emails ? " Emails go out 20 every 5 minutes." : ""}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "It couldn't be sent." };
  }
}
