/** Only the landing page keeps the public header and footer; every other page uses the menu bar. */
export const SITE_PAGES = "^/$";
export const chromeFor = (path: string) => (new RegExp(SITE_PAGES).test(path) ? "site" : "app");
