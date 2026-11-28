import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getExtras } from "@/lib/tmdb";

/**
 * Saves TMDB's extra details on one film: themes, age rating, series, title logo, stills, studios,
 * tagline, budget, box office and recommendations. Other titles join the film's `aka` list (titles
 * already there stay). Returns whether anything new came back.
 */
export async function fillExtras(db: SupabaseClient, film: { id: string; tmdb_id: number | null; title: string; original_title?: string | null; aka?: string[] | null }) {
  if (!film.tmdb_id) return false;
  const x = await getExtras(film.tmdb_id);
  const known = new Set([film.title, film.original_title].filter(Boolean).map((t) => (t as string).toLowerCase()));
  const aka = [...(film.aka ?? [])];
  for (const t of x.titles) {
    if (aka.length >= 12) break;
    if (!known.has(t.toLowerCase()) && !aka.some((a) => a.toLowerCase() === t.toLowerCase())) aka.push(t);
  }
  const { titles: _titles, ...fields } = x;
  void _titles;
  const { error } = await db.from("films").update({ ...fields, aka, extras_at: new Date().toISOString() }).eq("id", film.id);
  if (error) throw error;
  return Boolean(x.keywords.length || x.certification || x.series || x.logo_url || x.stills.length || x.companies.length || x.tagline);
}
