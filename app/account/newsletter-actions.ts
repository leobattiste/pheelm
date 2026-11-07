"use server";

import { getServerClient } from "@/lib/supabase/server";

export type NewsletterState = { ok: boolean; message: string } | null;

export async function subscribeSignedIn(_previous: NewsletterState, _form: FormData): Promise<NewsletterState> {
  const db = await getServerClient();
  if (!db) return { ok: false, message: "Newsletter sign-up is unavailable." };
  const { data: { user } } = await db.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return { ok: false, message: "Sign in with an email address to subscribe." };
  const { error } = await db.from("subscribers").insert({ email, source: "settings" });
  if (error?.code === "23505") return { ok: true, message: "You're already subscribed." };
  if (error) return { ok: false, message: "Could not subscribe right now. Please try again." };
  return { ok: true, message: "You're subscribed." };
}
