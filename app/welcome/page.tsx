import { privateMetadata } from "@/lib/seo";
import { safeInternalPath } from "@/lib/safe-navigation";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { welcomePicks } from "@/lib/catalog-summaries";
import { getServerClient } from "@/lib/supabase/server";
import Welcome from "./Welcome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = privateMetadata("Welcome");

/**
 * After signing up: choose a name and handle, follow a few directors, save a few films. Every step
 * can be skipped; it ends on Films (or wherever the person was headed).
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const destination = safeInternalPath(sp.next);
  const next = destination && !destination.startsWith("/welcome") ? destination : "/films";
  const db = await getServerClient();
  if (!db) redirect(next);
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { people, films: picks }] = await Promise.all([
    db.from("profiles").select("handle, display_name, avatar_url, bio, social_platform, social_url, website_url").eq("id", user.id).maybeSingle(),
    welcomePicks(),
  ]);
  const p = (profile ?? {}) as { handle?: string | null; display_name?: string | null; avatar_url?: string | null; bio?: string | null; social_platform?: string | null; social_url?: string | null; website_url?: string | null };

  return <Welcome links={p} avatarUrl={p.avatar_url ?? null} bio={p.bio ?? null} next={next} userId={user.id} handle={p.handle ?? null} name={p.display_name ?? null} people={people} films={picks} />;
}
