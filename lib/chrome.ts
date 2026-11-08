/**
 * Two kinds of page. "site" pages (home, about, contact, the legal pages, signing in) have the
 * header and footer. Everything else is the app: for members it has no header or footer, just the
 * floating tab bar, with the menu (and what the footer held) under ⋯.
 */
export const SITE_PAGES = "^/($|(about|partnerships|contact|donate|newsletter|legal|privacy|terms|login|auth|offline)(/|$))";
export const chromeFor = (path: string) => (new RegExp(SITE_PAGES).test(path) ? "site" : "app");
