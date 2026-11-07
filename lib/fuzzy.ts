/**
 * Search matching that forgives accents and small typos, so "Sembene", "Ousmane Sembane" and
 * "souleyman cisse" all find what they mean.
 *
 * Every word typed must match a word in the text: as part of it ("semb" in "sembene"), or, for
 * words of 4 letters or more, within one typo (two for 8 letters or more). A typo is a missing,
 * extra, wrong or swapped letter.
 */

/** Lower case, no accents. */
export const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const tokens = (s: string) => s.split(/[^a-z0-9]+/).filter(Boolean);

/** Damerau-Levenshtein distance, giving up once it's over `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) rows.push([i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      rows[i][j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
  }
  return rows[a.length][b.length];
}

const allowed = (word: string) => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

/**
 * How well `query` matches `text` (both already plain): 2 if every word is found as typed,
 * 1 if some needed a typo forgiven, 0 if it doesn't match.
 */
export function matchScore(query: string, text: string): 0 | 1 | 2 {
  const words = tokens(query);
  if (!words.length) return 0;
  const parts = tokens(text);
  let fuzzy = false;
  for (const w of words) {
    if (text.includes(w)) continue;
    const max = allowed(w);
    if (!max) return 0;
    // Compare with whole words, and with their starts, so a half-typed word with a typo still counts.
    const ok = parts.some((p) => distance(w, p, max) <= max || (p.length > w.length && distance(w, p.slice(0, w.length), max) <= max));
    if (!ok) return 0;
    fuzzy = true;
  }
  return fuzzy ? 1 : 2;
}
