/** Only the landing page keeps the public header and footer; every other page uses the menu bar. */
export const SITE_PAGES = "^/$";
/** The admin is its own app with its own sidebar, so neither the header nor the menu bar shows there. */
export const ADMIN_PAGES = "^/admin(/|$)";
export const chromeFor = (path: string) => (new RegExp(ADMIN_PAGES).test(path) ? "admin" : new RegExp(SITE_PAGES).test(path) ? "site" : "app");
