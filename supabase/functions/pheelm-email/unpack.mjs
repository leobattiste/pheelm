// Rebuilds each email's HTML and plain text from templates.compact.json (see scripts/email-previews.mjs).
// Every email shares a layout; the words that differ are stored per email and filled in here.
// What is left as [[TOKENS]] is filled when the email is sent: MESSAGE, ACTION_URL, UNSUBSCRIBE_URL, POSTAL_ADDRESS, YEAR.
export const FIELDS = ['TITLE', 'PREHEADER', 'BUTTON', 'NOTE', 'L1', 'T1', 'L2', 'T2', 'L3', 'T3'];
const FILLER = '\u00a0\u200c\u200b\u200d\ufeff';
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
/** Layouts store repeated markup once, in `parts`, and refer to part n as {%n%}. */
const expand = (s, parts = []) => s.replace(/\{%(\d+)%\}/g, (_, n) => parts[Number(n)]);
export function unpack(packed) {
  const out = {};
  const layouts = packed.layouts.map((l) => ({ html: expand(l.html, packed.parts), text: expand(l.text, packed.parts) }));
  for (const [id, t] of Object.entries(packed.templates)) {
    const l = layouts[t.layout];
    // Filler after the inbox preview line so a client doesn't continue into the body (about 150 characters in all).
    const pad = FILLER.repeat(Math.max(0, Math.ceil((150 - t.fields.PREHEADER.length) / FILLER.length)));
    const fill = (s, html) => FIELDS.reduce((acc, f) => acc.split(`[[${f}]]`).join(html ? escape(t.fields[f] ?? '') : (t.fields[f] ?? '')), s.split('[[PAD]]').join(html ? pad : ''));
    out[id] = { subject: t.subject, category: t.category, html: fill(l.html, true), text: fill(l.text, false) };
  }
  return out;
}
