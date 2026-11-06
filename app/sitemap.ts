import type { MetadataRoute } from "next";
import { getCommunityCollections } from "@/lib/community";
import { getDirectors, getFilms } from "@/lib/data";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [films, directors, collections] = await Promise.all([getFilms(), getDirectors(), getCommunityCollections()]);
  const page = (path: string) => ({ url: `${SITE_URL}${path}` });
  return [
    page("/"), page("/films"), page("/directors"), page("/collections"),
    page("/about"), page("/partnerships"), page("/contact"), page("/donate"), page("/newsletter"), page("/privacy"), page("/terms"),
    ...films.map((f) => page(`/films/${f.slug}`)),
    ...directors.map((d) => page(`/directors/${d.slug}`)),
    ...collections.map((c) => page(`/c/${c.id}`)),
  ];
}
