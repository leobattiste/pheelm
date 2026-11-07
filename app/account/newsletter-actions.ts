"use server";

import { revalidatePath } from "next/cache";
import { getServerClient } from "@/lib/supabase/server";

export type NewsletterState = { ok: boolean; subscribed: boolean; message: string } | null;

export async function setNewsletterSubscription(_previous: NewsletterState, form: FormData): Promise<NewsletterState> {
  const db = await getServerClient();
  if (!db) return { ok: false, subscribed: false, message: "Newsletter settings are unavailable." };
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email) return { ok: false, subscribed: false, message: "Sign in to manage your subscription." };
  const subscribe = form.get("subscribe") === "true";
  const { data, error } = await db.rpc("set_my_newsletter_subscription", { want_subscribed: subscribe });
  if (error) return { ok: false, subscribed: !subscribe, message: "Could not update your subscription. Try again." };
  revalidatePath("/account");
  return { ok: true, subscribed: data === true, message: subscribe ? "You're subscribed." : "You've unsubscribed." };
}
