import { getPublicWatchlists } from "@/lib/watchlists";
import { watchlistPath } from "@/lib/watchlist-links";
import { getPublicProfileHandles } from "@/lib/community";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 3600;

/** Open informational pages and public member profiles; private accounts stay excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string) => ({ url: `${SITE_URL}${path}` });
  const [profiles,watchlists]=await Promise.all([getPublicProfileHandles(),getPublicWatchlists()]);
  return [...["/", "/watchlists", "/about", "/help", "/partnerships", "/contact", "/donate", "/newsletter", "/legal", ...profiles.map(handle=>`/@${handle}`)].map(page),...watchlists.map(list=>({url:`${SITE_URL}${watchlistPath(list)}`,lastModified:list.updated_at}))];
}
