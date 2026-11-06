/** Change the name and tagline here; everything on the site reads from this file. */
export const SITE_NAME = "Pheelm";
export const SITE_TAGLINE = "Discover films by Black directors around the world.";
export const SITE_DESCRIPTION =
  "A platform to explore films, discover the people behind them, and learn more about their work.";

/** Each page's one-line description: shown under its title and used for search and sharing. */
export const PAGE_COPY = {
  home: "Discover films, explore directors, and learn more about Black cinema around the world.",
  films: "Explore films by Black directors across countries, genres, and years.",
  directors: "Discover Black directors, their backgrounds, and their work.",
  collections: "Explore curated selections of films based on themes, genres, and more.",
  about: "Learn more about Pheelm and why we created the platform.",
  submit: "Help grow the platform by suggesting films we're missing.",
  signIn: "Sign in or create an account to save films and make collections.",
  account: "Manage your account and your film submissions.",
  watchlist: "Save films you want to watch later.",
  submissions: "View your film submissions and their status.",
} as const;

/**
 * Contact and social links. Set them in Vercel (Settings → Environment Variables) or write them
 * here. Anything left empty is simply not shown.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "";
export const THREADS_URL = process.env.NEXT_PUBLIC_THREADS_URL ?? "";

/** The date the privacy policy and terms were last changed, shown at the top of each. */
export const LEGAL_UPDATED = "5 November 2026";
