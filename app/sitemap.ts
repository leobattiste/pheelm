import { getPublicProfileHandles } from "@/lib/community";
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 3600;

/** Open informational pages and public member profiles; private accounts stay excluded. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string) => ({ url: `${SITE_URL}${path}` });
  const profiles=await getPublicProfileHandles();
  return ["/", "/about", "/help", "/partnerships", "/contact", "/donate", "/newsletter", "/legal", ...profiles.map(handle=>`/@${handle}`)].map(page);
}
