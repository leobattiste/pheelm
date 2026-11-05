"use server";

import { getServerClient } from "@/lib/supabase/server";

export type FormState = { ok: boolean; message: string } | null;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TOPICS = ["general", "correction", "partnership", "press", "privacy"] as const;

/** Newsletter sign-up. Signing up twice is fine: the second time says you're already on the list. */
export async function subscribe(_prev: FormState, f: FormData): Promise<FormState> {
  if (f.get("website")) return { ok: true, message: "Thanks. You're on the list." }; // a bot filled the hidden field
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, message: "Enter an email address, like you@example.com." };
  const db = await getServerClient();
  if (!db) return { ok: false, message: "The newsletter isn't open yet. Check back soon." };
  const { error } = await db.from("subscribers").insert({ email, source: String(f.get("source") ?? "site").slice(0, 40) });
  if (error?.code === "23505") return { ok: true, message: "You're already on the list." };
  if (error) return { ok: false, message: "The newsletter isn't open yet. Check back soon." };
  return { ok: true, message: "Thanks. You're on the list." };
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
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Messages can't be sent from here yet. Check back soon." };
  const { error } = await db.from("messages").insert({
    name: String(f.get("name") ?? "").trim().slice(0, 200) || null,
    organization: String(f.get("organization") ?? "").trim().slice(0, 200) || null,
    email,
    topic: (TOPICS as readonly string[]).includes(topic) ? topic : "general",
    body,
  });
  if (error) return { ok: false, message: "Messages can't be sent from here yet. Check back soon." };
  return { ok: true, message: `Thanks. We'll reply to ${email}.` };
}
