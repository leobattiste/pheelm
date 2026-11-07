import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/me", "/api", "/account", "/notifications", "/auth", "/login", "/search-index", "/random"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
