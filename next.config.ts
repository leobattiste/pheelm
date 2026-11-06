import type { NextConfig } from "next";

// Supabase and Vercel's Supabase integration name these keys in a few different ways.
// Whichever is set, pass it to the browser under the names the site reads.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";

if (process.env.VERCEL && (!supabaseUrl || !supabaseKey)) {
  // Shows in the Vercel build log, so a missing key is easy to spot.
  console.warn(
    "\n⚠ Supabase keys not found: accounts, watchlists and the admin stay off.\n" +
      "  Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for the Production environment in Vercel, then redeploy.\n",
  );
}

const nextConfig: NextConfig = {
  // Posters come from many places (TMDB, Supabase storage, links pasted in the admin).
  images: { unoptimized: true },
  // The share images read Nacelle from assets/fonts at run time, so ship those files with them.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/fonts/**"],
    "/films/[slug]/opengraph-image": ["./assets/fonts/**"],
  },
  staticPageGenerationTimeout: 180,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nobody else can put the site in a frame (stops clickjacking on sign-in and the admin).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey.trim(),
  },
};

export default nextConfig;
