// Films, Directors and Watchlists show a screenful at a time. Thousands of cards at once is slow
// to draw and slow to scroll, and the one page size keeps the three lists consistent.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { build } from "esbuild";
import vm from "node:vm";
import { createRequire } from "node:module";

const PAGE_SIZE = 24;

// One number, used everywhere, so the three lists cannot drift apart.
const site = readFileSync("lib/site.ts", "utf8");
assert.match(site, new RegExp(`export const PAGE_SIZE = ${PAGE_SIZE};`), `the shared page size should be ${PAGE_SIZE}`);
for (const [file, what] of [
  ["components/CatalogSearch.tsx", "Films and Directors"],
  ["components/CatalogListing.tsx", "the listing shown without JavaScript"],
  ["components/WatchlistsBrowser.tsx", "the Watchlists feed"],
  ["lib/collection-sorts.ts", "the Watchlists window"],
]) assert.match(readFileSync(file, "utf8"), /PAGE_SIZE/, `${what} should use the shared page size, not a number of its own`);

// The Watchlists feed shows a window and offers more only when there is more.
const browser = readFileSync("components/WatchlistsBrowser.tsx", "utf8");
assert.match(browser, /list\.slice\(0, shown\)/, "the Watchlists feed should render only its window");
assert.match(browser, /shown < list\.length &&/, "Load more should appear only when tiles are left");

// Changing the sort, feed or film is a different list, so the count starts over. This is the part
// that is easy to get wrong, and the feed is empty without Supabase, so it is checked directly.
const bundle = await build({
  stdin: { contents: `export { shownFor, windowKey } from './lib/collection-sorts';`, loader: "ts", resolveDir: process.cwd() },
  bundle: true, write: false, format: "cjs", platform: "node", external: ["server-only"],
});
const mod = { exports: {} };
const req = createRequire(import.meta.url);
vm.runInNewContext(bundle.outputFiles[0].text, { module: mod, exports: mod.exports, require: (n) => (n === "server-only" ? {} : req(n)), console, process });
const { shownFor, windowKey } = mod.exports;
const first = windowKey("popular", "all", null);
assert.equal(shownFor({ list: "", shown: 96 }, first), PAGE_SIZE, "a fresh list starts at one page");
assert.equal(shownFor({ list: first, shown: 96 }, first), 96, "the same list keeps the count it was given");
assert.equal(shownFor({ list: first, shown: 96 }, windowKey("new", "all", null)), PAGE_SIZE, "a new sort starts at one page");
assert.equal(shownFor({ list: first, shown: 96 }, windowKey("popular", "featured", null)), PAGE_SIZE, "a new feed starts at one page");
assert.equal(shownFor({ list: first, shown: 96 }, windowKey("popular", "all", "atlantics")), PAGE_SIZE, "filtering to a film starts at one page");
// An empty ?film= filters nothing, the same as no film at all, so the two share a window.
assert.equal(windowKey("popular", "all", null), windowKey("popular", "all", ""), "no film and an empty film are the same list");

// Films and Directors have enough rows in the starter catalog to show the window growing.
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await chrome.newPage();
try {
  for (const [path, cards] of [["/films", ".film-grid .film-card"], ["/directors", ".director-grid > li"]]) {
    await page.goto((process.env.PHEELM_URL ?? "http://localhost:3000") + path, { waitUntil: "networkidle" });
    assert.equal(await page.locator(cards).count(), PAGE_SIZE, `${path} should show ${PAGE_SIZE} cards`);
    const more = page.getByRole("button", { name: /load more/i });
    assert.equal(await more.count(), 1, `${path} should offer Load more`);
    await more.click();
    await page.waitForFunction((n) => document.querySelectorAll(n.cards).length > n.size, { cards, size: PAGE_SIZE }, { timeout: 5000 });
    assert.equal(await page.locator(cards).count(), PAGE_SIZE * 2, `${path} should show ${PAGE_SIZE * 2} cards after one press`);
  }
} finally {
  await chrome.close();
}

console.log("ok  lists show 24 at a time");
