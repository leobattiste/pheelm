// A film page is lit by its poster's colour: the bars take a wash of it (Trailer stays solid ink,
// the same on every film), sheets opened over the page take it as text on a transparent control, and the
// poster itself is never touched. Accents live in the database, so the page is tinted here the
// same way FilmTint does it, and the CSS is what gets checked.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const BASE = process.env.PHEELM_URL ?? "http://localhost:3000";
const ACCENT = "#ea7f53", ON_ACCENT = "#0c0c0c";
const rgb = (hex) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const css = (sel, prop) => page.evaluate(({ sel, prop }) => {
  const el = document.querySelector(sel);
  return el ? getComputedStyle(el).getPropertyValue(prop) : null;
}, { sel, prop });

try {
  await page.goto(`${BASE}/films/atlantics`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-action="trailer"]');

  // Untinted first: the page looks as it always did, so a monotone poster costs nothing.
  const plainTrailer = await css('[data-action="trailer"]', "background-color");
  assert.notEqual(plainTrailer, rgb(ACCENT), "without an accent the button should not be tinted");
  // The wash is still drawn, but both ends of it are fully transparent, so nothing shows.
  const plainWash = await css("body", "background-image");
  assert.match(plainWash, /radial-gradient/, "the page keeps its wash rule");
  assert.match(plainWash, /srgb 0 0 0 \/ 0\)|rgba\(0, 0, 0, 0\)/, "without an accent the wash is transparent");

  await page.addStyleTag({ content: `:root{--film-accent:${ACCENT};--film-on-accent:${ON_ACCENT};--film-glass:color-mix(in srgb, var(--film-accent) 12%, var(--glass-bg))}` });
  // Controls fade between colours, so wait for the new one to settle rather than a frame of it.
  await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--film-accent').trim() !== '', null, { timeout: 5000 });

  // The page itself is lit: this is the main effect, the button is the accent on top of it.
  const wash = await css("body", "background-image");
  assert.match(wash, /radial-gradient/, "the page should carry a wash of the colour");
  assert.match(wash, /0\.917647 0\.498039 0\.32549|234, 127, 83/, "the wash should be the film's colour");
  assert.match(wash, /\/ 0\.18\)|0\.18\)/, "the wash stays faint: it lights the page, it does not paint it");

  // Trailer is the same on every film: solid ink, untouched by the film's colour.
  assert.equal(await css('[data-action="trailer"]', "background-color"), plainTrailer, "Trailer should stay solid ink");
  assert.notEqual(await css('[data-action="trailer"]', "background-color"), rgb(ACCENT), "Trailer should not take the accent");

  // Watchlist sits beside it and stays secondary: it must not take the fill too.
  assert.notEqual(await css('[data-action="watchlist"]', "background-color"), rgb(ACCENT), "only the primary action is filled");

  // The poster is the source of the colour, never a surface for it.
  assert.equal(await css(".film-art .poster", "filter"), "none", "the poster takes no filter");
  assert.notEqual(await css(".film-art .poster", "background-color"), rgb(ACCENT), "the poster is not washed with the accent");

  // A sheet over the page keeps its transparent controls, so there the colour is the text.
  await page.evaluate(() => document.querySelector(".person-sheet")?.showModal());
  await page.waitForTimeout(500);
  const sheet = await page.evaluate(() => {
    const d = document.querySelector(".person-sheet");
    if (!d?.open) return null;
    const b = document.createElement("button");
    b.className = "button primary"; b.textContent = "Follow";
    d.querySelector(".modal-body")?.append(b);
    const cs = getComputedStyle(b);
    return { background: cs.backgroundColor, color: cs.color };
  });
  assert.ok(sheet, "the person sheet should open");
  assert.match(sheet.background, /rgba\(0, 0, 0, 0\)|transparent/, "a primary button in a sheet keeps a transparent background");
  assert.equal(sheet.color, rgb(ACCENT), "a primary button in a sheet is the accent in text");

  // Off the film page, dialogs are untouched: the tint must not leak into the rest of the site.
  await page.goto(`${BASE}/watchlists`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const leaked = await page.evaluate(() => {
    const d = document.createElement("dialog");
    d.innerHTML = '<button class="button primary">Save</button>';
    document.body.append(d); d.showModal();
    const cs = getComputedStyle(d.querySelector("button"));
    const out = { background: cs.backgroundColor, color: cs.color };
    d.remove();
    return out;
  });
  assert.doesNotMatch(leaked.background, /rgba\(0, 0, 0, 0\)/, "off a film page, a primary button in a dialog keeps its fill");
} finally {
  await browser.close();
}

console.log("ok  the film page is lit by its poster, and nothing else is");
