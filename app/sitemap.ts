import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export const revalidate = 3600;

/** While Pheelm is in early access, only the open pages are listed; the rest needs an account. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const page = (path: string) => ({ url: `${SITE_URL}${path}` });
  return ["/", "/about", "/help", "/partnerships", "/contact", "/donate", "/newsletter", "/legal"].map(page);
}
