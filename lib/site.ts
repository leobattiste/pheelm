/** Change the name and tagline here; everything on the site reads from this file. */
export const SITE_NAME = "Pheelm";
/** How the name is set as the logo: lowercase, in Beth Ellen. */
export const WORDMARK = "pheelm";
export const SITE_TAGLINE = "Discover films by Black directors around the world.";
export const SITE_DESCRIPTION =
  "Discover films by Black directors around the world: features, documentaries and shorts from Africa, the Americas, Europe and the Caribbean, with the people behind them and where to watch.";

/** Each page's one-line description: shown under its title and used for search and sharing. */
export const PAGE_COPY = {
  home: "Discover films, explore directors, and learn more about Black cinema around the world.",
  films: "Explore films by Black directors across countries, genres, and years.",
  directors: "Discover Black directors, their backgrounds, and their work.",
  collections: "Explore curated selections of films based on themes, genres, and more.",
  about: "Learn more about Pheelm and why we created the platform.",
  submit: "Suggest a film you think we should feature on Pheelm.",
  submitOwn: "Own a film or represent its rights holder? Share the details for its film page. We review submissions before publication. Include the information you want on the film page.",
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
/** Where the Donate link goes (a Stripe, Ko-fi or Open Collective page). Empty: the Donate page says donations open soon. */
export const DONATE_URL = process.env.NEXT_PUBLIC_DONATE_URL ?? "";
export const INSTAGRAM_URL = process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "";
export const THREADS_URL = process.env.NEXT_PUBLIC_THREADS_URL ?? "";

/** The date the privacy policy and terms were last changed, shown at the top of each. */
export const LEGAL_UPDATED = "8 November 2026";

/** Members with a check beside their name, and what it says. */
export const VERIFIED: Record<string, string> = {
  leo: "Creative Director at Pheelm",
};
