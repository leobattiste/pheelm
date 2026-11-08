/** The landing page and authentication keep the public header; other pages use the member bar. */
export const SITE_PAGES = "^/($|(login|auth|offline)(/|$))";
export const chromeFor = (path: string) => (new RegExp(SITE_PAGES).test(path) ? "site" : "app");
