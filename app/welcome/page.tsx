import { privateMetadata } from "@/lib/seo";
import { safeInternalPath } from "@/lib/safe-navigation";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDirectors, getFilms } from "@/lib/data";
import { countryName } from "@/lib/format";
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

  const [{ data: profile }, films, directors] = await Promise.all([
    db.from("profiles").select("handle, display_name, avatar_url, bio, social_platform, social_url, website_url").eq("id", user.id).maybeSingle(),
    getFilms(),
    getDirectors(),
  ]);
  const p = (profile ?? {}) as { handle?: string | null; display_name?: string | null; avatar_url?: string | null; bio?: string | null; social_platform?: string | null; social_url?: string | null; website_url?: string | null };

  // Directors with the most films on Pheelm, then essential films with posters.
  const people = [...directors]
    .sort((a, b) => Number(!!b.photo_url) - Number(!!a.photo_url) || b.films.length - a.films.length)
    .slice(0, 12)
    .map((d) => ({ id: d.id, name: d.name, place: d.country ? countryName(d.country) : null, photo: d.photo_url }));
  const picks = films
    .filter((f) => f.poster_url && (f.note || f.featured))
    .sort((a, b) => Number(!!b.note) - Number(!!a.note) || b.year - a.year)
    .slice(0, 12)
    .map((f) => ({ id: f.id, title: f.title, year: f.year, poster: f.poster_url, directors: f.directors.map((d) => d.name) }));

  return <Welcome links={p} avatarUrl={p.avatar_url ?? null} bio={p.bio ?? null} next={next} userId={user.id} handle={p.handle ?? null} name={p.display_name ?? null} people={people} films={picks} />;
}
