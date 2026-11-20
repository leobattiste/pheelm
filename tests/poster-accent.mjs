// The accent is the colour a person would name when shown the poster, and it must always be
// readable as a button. Posters here are generated, so this runs offline and in CI.
import assert from "node:assert/strict";
import { build } from "esbuild";
import vm from "node:vm";
import { createRequire } from "node:module";
import sharp from "sharp";

const req = createRequire(import.meta.url);
const bundle = await build({
  stdin: { contents: `export * from './lib/poster-accent';`, loader: "ts", resolveDir: process.cwd() },
  bundle: true, write: false, format: "cjs", platform: "node", external: ["server-only"],
});
const mod = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module: mod, exports: mod.exports, require: (n) => (n === "server-only" ? {} : req(n)), console, process, Uint8Array, Float64Array, Buffer });
const { accentFromPixels, accentFor, fromHex, toHsl, contrast } = mod.exports;

const W = 48, H = 72;
/** A poster: a background, with optional blocks painted on it. */
async function poster(bg, blocks = []) {
  let img = sharp({ create: { width: W, height: H, channels: 3, background: bg } });
  if (blocks.length) {
    img = img.composite(await Promise.all(blocks.map(async (b) => ({
      input: await sharp({ create: { width: b.w, height: b.h, channels: 3, background: b.color } }).png().toBuffer(),
      left: b.left, top: b.top,
    }))));
  }
  const { data } = await sharp(await img.png().toBuffer()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return data;
}
const hueOf = (hex) => toHsl(fromHex(hex)).h;
/** Hue distance in degrees, the short way round the wheel. */
const hueGap = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return Math.min(d, 360 - d); };

// 1. A dark poster with a small bright title block: the title's colour wins, not the black.
// This is the case the old dominant-bin colour got wrong on 703 films.
{
  const px = await poster({ r: 8, g: 8, b: 8 }, [{ w: 40, h: 10, left: 4, top: 56, color: { r: 220, g: 38, b: 38 } }]);
  const accent = accentFromPixels(px);
  assert.ok(accent, "a dark poster with a red title should have an accent");
  assert.ok(hueGap(hueOf(accent), 0) < 20, `expected a red accent, got ${accent}`);
}

// 2. A pale poster with a teal block: the near-white must not win either.
{
  const px = await poster({ r: 248, g: 248, b: 248 }, [{ w: 24, h: 24, left: 12, top: 24, color: { r: 13, g: 148, b: 136 } }]);
  const accent = accentFromPixels(px);
  assert.ok(accent, "a pale poster with a teal block should have an accent");
  assert.ok(hueGap(hueOf(accent), 174) < 25, `expected a teal accent, got ${accent}`);
}

// 3. The bigger of two colours wins.
{
  const px = await poster({ r: 8, g: 8, b: 8 }, [
    { w: 44, h: 50, left: 2, top: 2, color: { r: 37, g: 99, b: 235 } },   // blue, large
    { w: 10, h: 6, left: 4, top: 62, color: { r: 234, g: 179, b: 8 } },    // yellow, small
  ]);
  assert.ok(hueGap(hueOf(accentFromPixels(px)), 221) < 25, "the larger blue should win over the small yellow");
}

// 4. A poster split across two nearby hues reads as one colour, not an average of opposites.
{
  const px = await poster({ r: 8, g: 8, b: 8 }, [
    { w: 44, h: 30, left: 2, top: 2, color: { r: 190, g: 30, b: 60 } },
    { w: 44, h: 30, left: 2, top: 34, color: { r: 220, g: 70, b: 40 } },
  ]);
  const h = hueOf(accentFromPixels(px));
  assert.ok(h < 30 || h > 330, `two neighbouring reds should stay red, got hue ${Math.round(h)}`);
}

// 5. A greyscale poster claims no colour, so the page stays neutral rather than faintly tinted.
for (const grey of [{ r: 8, g: 8, b: 8 }, { r: 248, g: 248, b: 248 }, { r: 128, g: 128, b: 128 }])
  assert.equal(accentFromPixels(await poster(grey)), null, "a grey poster should have no accent");

// 6. Every accent must be readable in both themes. A hue sweep at awkward lightnesses.
for (let h = 0; h < 360; h += 15) {
  for (const [s, l] of [[1, 0.5], [0.95, 0.08], [0.9, 0.95], [0.3, 0.5], [1, 0.25], [0.6, 0.8]]) {
    const start = mod.exports.toHex(mod.exports.fromHsl(h, s, l));
    const a = accentFor(start);
    assert.ok(a, `hue ${h} at ${s}/${l} should produce an accent (${start})`);
    for (const [fill, text, theme] of [[a.light, a.onLight, "light"], [a.dark, a.onDark, "dark"]]) {
      const ratio = contrast(fromHex(fill), fromHex(text));
      assert.ok(ratio >= 4.5, `${theme}: ${text} on ${fill} is only ${ratio.toFixed(2)}:1 (from ${start})`);
    }
    // The hue survives the adjustment, or the page would not match the poster.
    assert.ok(hueGap(hueOf(a.light), h) < 12, `the light accent should keep hue ${h}, got ${a.light}`);
    assert.ok(hueGap(hueOf(a.dark), h) < 12, `the dark accent should keep hue ${h}, got ${a.dark}`);
  }
}

// 7. A colourless input gets no accent, so nothing is tinted grey-on-grey.
for (const grey of ["#080808", "#f8f8f8", "#808080", "#2b2b2b"])
  assert.equal(accentFor(grey), null, `${grey} has no colour to use`);
assert.equal(accentFor(null), null, "no stored colour, no accent");
assert.equal(accentFor("not a colour"), null, "a bad value is ignored rather than thrown");

console.log("ok  poster accents are characteristic and readable");
