import type { MetadataRoute } from "next";
import { getArticles, getCollections, getDirectors, getFilms } from "@/lib/data";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [films, directors, collections, articles] = await Promise.all([getFilms(), getDirectors(), getCollections(), getArticles()]);
  const page = (path: string) => ({ url: `${SITE_URL}${path}` });
  return [
    page("/"), page("/films"), page("/directors"), page("/collections"), page("/journal"),
    ...films.map((f) => page(`/films/${f.slug}`)),
    ...directors.map((d) => page(`/directors/${d.slug}`)),
    ...collections.map((c) => page(`/collections/${c.slug}`)),
    ...articles.map((a) => page(`/journal/${a.slug}`)),
  ];
}
