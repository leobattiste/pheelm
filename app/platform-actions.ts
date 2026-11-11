"use server";

import { PARTNERSHIP_TYPES, PARTNERSHIP_SUCCESS } from "@/lib/partnership";
import { websiteUrl } from "@/lib/profile-links";
import { getServerClient } from "@/lib/supabase/server";
import { passesTurnstile } from "@/lib/turnstile";
import { safeInternalPath } from "@/lib/safe-navigation";

export type FormState = { ok: boolean; message: string } | null;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOPICS = ["general", "feedback", "correction", "partnership", "press", "privacy"] as const;

/** Newsletter sign-up. Signing up twice is fine: the second time says you're already on the list. */
export async function subscribe(_prev: FormState, f: FormData): Promise<FormState> {
  if (f.get("website")) return { ok: true, message: "Check your inbox to confirm your subscription." }; // a bot filled the hidden field
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: "Enter an email address, like you@example.com." };
  if (!(await passesTurnstile(f))) return { ok: false, message: "We couldn't check you're not a bot. Try again in a moment." };
  const db = await getServerClient();
  if (!db) return { ok: false, message: "The newsletter isn't open yet. Check back soon." };
  const { error } = await db.from("subscribers").insert({ email, source: String(f.get("source") ?? "site").slice(0, 40) });
  if (error?.code === "23505") return { ok: true, message: "Your subscription request is already recorded. Check your inbox for confirmation." };
  if (error) return { ok: false, message: "The newsletter isn't open yet. Check back soon." };
  return { ok: true, message: "Check your inbox to confirm your subscription." };
}

/** The contact and partnership forms. Messages go to the admin inbox. */
export async function sendMessage(_prev: FormState, f: FormData): Promise<FormState> {
  if (f.get("website")) return { ok: true, message: "Thanks. Your message is on its way." };
  const email = String(f.get("email") ?? "").trim();
  const body = String(f.get("body") ?? "").trim();
  const topic = String(f.get("topic") ?? "general");
  if (!EMAIL.test(email)) return { ok: false, message: "Enter your email address so we can reply." };
  if (!body) return { ok: false, message: "Write a message first." };
  if (body.length > 5000) return { ok: false, message: "That's a long one. Keep it under 5,000 characters." };
  const name = String(f.get("name") ?? "").trim();
  let messageBody = body;
  if (topic === "partnership") {
    const type = String(f.get("partnership_type") ?? "");
    if (body.length > 4000) return { ok: false, message: "Keep your proposal under 4,000 characters." };
    if (!name || name.length > 200) return { ok: false, message: "Enter your full name, up to 200 characters." };
    if (!(PARTNERSHIP_TYPES as readonly string[]).includes(type)) return { ok: false, message: "Choose a partnership type." };
    let url: string | null;
    try { url = websiteUrl(String(f.get("partnership_url") ?? "")); }
    catch { return { ok: false, message: "Enter a valid website or social media link." }; }
    messageBody = [`Partnership type: ${type}`, url ? `Website or social media: ${url}` : null, "", "Proposal:", body].filter(line => line !== null).join("\n");
    if (messageBody.length > 5000) return { ok: false, message: "Keep your proposal under 4,000 characters." };
  }
  if (!(await passesTurnstile(f))) return { ok: false, message: "We couldn't check you're not a bot. Try again in a moment." };
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Messages can't be sent from here yet. Check back soon." };
  // What the message is about: the page (or part of one) it was sent from.
  const pageRaw = String(f.get("page") ?? "").trim();
  const page = pageRaw.length <= 500 ? safeInternalPath(pageRaw) : null;
  const pageTitle = page ? String(f.get("page_title") ?? "").trim().slice(0, 200) || page : null;
  const row: Record<string, string | null> = {
    name: String(f.get("name") ?? "").trim().slice(0, 200) || null,
    organization: String(f.get("organization") ?? "").trim().slice(0, 200) || null,
    email,
    topic: (TOPICS as readonly string[]).includes(topic) ? topic : "general",
    body: messageBody,
  };
  let { error } = await db.from("messages").insert(page ? { ...row, page, page_title: pageTitle } : row);
  // Before feedback-page.sql has run: no "feedback" topic or page columns, so keep both in the message.
  if (error) {
    const note = [row.topic === "feedback" ? "Feedback" : null, page ? `About: ${pageTitle} (${page})` : null].filter(Boolean).join(". ");
    ({ error } = await db.from("messages").insert({
      ...row,
      topic: row.topic === "feedback" ? "general" : row.topic,
      body: note ? `${messageBody}\n\n${note}`.slice(0, 5000) : messageBody,
    }));
  }
  if (error) return { ok: false, message: "Messages can't be sent from here yet. Check back soon." };
  return { ok: true, message: topic === "partnership" ? PARTNERSHIP_SUCCESS : `Thanks. We'll reply to ${email}.` };
}
