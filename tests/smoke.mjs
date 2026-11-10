// Quick checks that the main pages open and work, run against a built site:
//   npm run build && npm start   (in one terminal)
//   npm run test:smoke           (in another; BASE_URL defaults to http://localhost:3000)
// Without Supabase keys the site runs on the starter catalog with no sign-in, so these cover
// browsing; signed-in flows need a test account and aren't covered here.
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const failures = [];
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`✗ ${name}\n  ${e instanceof Error ? e.message : e}`);
  }
};
const expect = (ok, what) => { if (!ok) throw new Error(what); };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await check("home shows the hero and a row of films", async () => {
  const res = await page.goto(BASE + "/", { waitUntil: "networkidle" });
  expect(res?.ok(), `status ${res?.status()}`);
  expect(await page.isVisible("h1"), "no heading");
  expect((await page.$$(".row .film-card")).length > 0, "no films in the row");
});

await check("films page lists films and filters them", async () => {
  await page.goto(BASE + "/films", { waitUntil: "networkidle" });
  const all = (await page.$$(".film-grid .film-card")).length;
  expect(all > 0, "no films");
  await page.fill(".search-bar input", "dust");
  await page.waitForTimeout(300);
  const some = (await page.$$(".film-grid .film-card")).length;
  expect(some > 0 && some <= all, `search gave ${some} of ${all}`);
});

await check("a film page opens with its title and menu", async () => {
  await page.goto(BASE + "/films", { waitUntil: "networkidle" });
  const href = await page.$eval(".film-grid a[href^='/films/']", (a) => a.getAttribute("href"));
  const res = await page.goto(BASE + href, { waitUntil: "networkidle" });
  expect(res?.ok(), `status ${res?.status()}`);
  expect(await page.isVisible(".film-title"), "no title");
  await page.click(".film-actions .more-button");
  await page.waitForSelector(".film-actions .more-panel[data-open] >> text=Give feedback", { timeout: 3000 });
});

await check("directors and collections pages open", async () => {
  for (const path of ["/directors", "/watchlists"]) {
    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    expect(res?.ok(), `${path}: status ${res?.status()}`);
  }
});

await check("info pages open", async () => {
  for (const path of ["/about", "/contact", "/privacy", "/terms"]) {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    expect(res?.ok(), `${path}: status ${res?.status()}`);
  }
});

await check("an unknown page shows the not-found page", async () => {
  const res = await page.goto(BASE + "/films/not-a-real-film-xyz", { waitUntil: "domcontentloaded" });
  expect(res?.status() === 404, `status ${res?.status()}`);
});

await check("no script errors on the way", async () => {
  expect(!errors.length, errors.join("; "));
});

await browser.close();
if (failures.length) {
  console.error(`\n${failures.length} failed.`);
  process.exit(1);
}
console.log("\nAll good.");
