import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Posters come from many places (TMDB, Supabase storage, links pasted in the admin).
  images: { unoptimized: true },
  staticPageGenerationTimeout: 180,
};

export default nextConfig;
