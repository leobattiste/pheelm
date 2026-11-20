/**
 * A poster's accent: the colour the film page is lit with.
 *
 * The importer used to store sharp's `stats().dominant`, which is the busiest bin of a coarse
 * histogram. Posters are mostly dark or mostly pale, so that answer came back near-black or
 * near-white for half the catalog — no colour to tint anything with. This picks the colour a person
 * would name instead: the hue with the most saturated presence, ignoring the black and white that
 * posters are largely made of.
 */

export type Rgb = { r: number; g: number; b: number };

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
export const toHex = ({ r, g, b }: Rgb) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
export function fromHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Hue in degrees, saturation and lightness in 0–1. */
export function toHsl({ r, g, b }: Rgb) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), span = max - min;
  const l = (max + min) / 2;
  if (!span) return { h: 0, s: 0, l };
  const s = span / (1 - Math.abs(2 * l - 1));
  const h = max === R ? ((G - B) / span + (G < B ? 6 : 0)) : max === G ? (B - R) / span + 2 : (R - G) / span + 4;
  return { h: h * 60, s, l };
}

export function fromHsl(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** Relative luminance, for the contrast ratios the text colour is chosen by. */
export function luminance({ r, g, b }: Rgb) {
  const channel = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** WCAG contrast ratio between two colours, 1 (identical) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const HUES = 24; // 15° buckets: wide enough that a gradient counts as one colour.

/**
 * The poster's accent, from raw RGB pixels (3 or 4 bytes each).
 *
 * Every pixel with some colour in it votes for its hue, weighted by how saturated it is and how
 * near mid-lightness — a pixel that is nearly black or nearly white says little about the hue, and
 * a faint wash should not outvote a small bright title card. The winning hue's weighted mean is
 * the accent. A poster with no colour at all (true black and white) returns null, and the caller
 * falls back to a neutral.
 */
export function accentFromPixels(pixels: Uint8Array | Buffer, channels = 3): string | null {
  const weight = new Float64Array(HUES);
  const sum = new Float64Array(HUES * 3);
  let colourful = 0, pixelCount = 0;
  for (let i = 0; i + channels <= pixels.length; i += channels) {
    if (channels === 4 && pixels[i + 3] < 128) continue;
    pixelCount++;
    const rgb = { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
    const { h, s, l } = toHsl(rgb);
    // Grey, nearly black and nearly white pixels carry no hue worth counting.
    if (s < 0.18 || l < 0.08 || l > 0.95) continue;
    colourful++;
    // Mid-lightness pixels describe the hue best; the curve peaks at l = 0.5 and never reaches 0.
    const presence = s * s * (0.35 + 0.65 * (1 - Math.abs(l - 0.5) * 2) ** 2);
    const bucket = Math.min(HUES - 1, Math.floor((((h % 360) + 360) % 360) / (360 / HUES)));
    weight[bucket] += presence;
    sum[bucket * 3] += rgb.r * presence;
    sum[bucket * 3 + 1] += rgb.g * presence;
    sum[bucket * 3 + 2] += rgb.b * presence;
  }
  // A poster needs a little real colour before one is claimed for it.
  if (!pixelCount || colourful / pixelCount < 0.02) return null;

  // Neighbouring buckets belong to the same colour, so each is scored with its two neighbours.
  let best = -1, bestScore = 0;
  for (let i = 0; i < HUES; i++) {
    const score = weight[i] + 0.5 * (weight[(i + 1) % HUES] + weight[(i + HUES - 1) % HUES]);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  if (best < 0 || !weight[best]) return null;
  return toHex({ r: sum[best * 3] / weight[best], g: sum[best * 3 + 1] / weight[best], b: sum[best * 3 + 2] / weight[best] });
}

/** What the film page needs: the accent at a usable strength, and a text colour that reads on it. */
export type Accent = { light: string; onLight: string; dark: string; onDark: string };

const BLACK = { r: 12, g: 12, b: 12 };
const WHITE = { r: 255, g: 255, b: 255 };

/**
 * A poster colour pushed to where it works as a solid button.
 *
 * A raw poster colour is rarely usable as it comes: it can be almost black, almost white, or so
 * saturated it shouts. The hue is kept — that is what ties the page to the film — while lightness
 * is pulled into a band and saturation into a range, separately for the light and dark themes. The
 * text colour is then whichever of near-black or white has the better contrast, and the colour is
 * darkened or lightened further until that contrast clears 4.5:1, so no film gets a button nobody
 * can read.
 */
export function accentFor(hex: string | null | undefined): Accent | null {
  const rgb = hex ? fromHex(hex) : null;
  if (!rgb) return null;
  const { h, s } = toHsl(rgb);
  // A colourless poster gets no tint rather than a grey one pretending to be a colour.
  if (s < 0.12) return null;
  const sat = clamp(s, 0.35, 0.78);
  return {
    ...readable(h, sat, 0.42),   // light theme: deep enough for white text
    ...readable(h, sat, 0.62, true), // dark theme: brighter, for near-black text
  } as Accent;
}

/** Walks lightness until the better of black or white text clears 4.5:1 on the colour. */
function readable(h: number, s: number, start: number, dark = false) {
  let best = fromHsl(h, s, start), bestRatio = 0, bestOn = WHITE;
  for (let step = 0; step <= 14; step++) {
    // Light theme walks darker (white text wins there); dark theme walks lighter.
    const l = clamp(start + (dark ? step : -step) * 0.03, 0.14, 0.9);
    const rgb = fromHsl(h, s, l);
    const on = contrast(rgb, WHITE) >= contrast(rgb, BLACK) ? WHITE : BLACK;
    const ratio = contrast(rgb, on);
    if (ratio > bestRatio) { bestRatio = ratio; best = rgb; bestOn = on; }
    if (ratio >= 4.5) break;
  }
  return dark
    ? { dark: toHex(best), onDark: toHex(bestOn) }
    : { light: toHex(best), onLight: toHex(bestOn) };
}
