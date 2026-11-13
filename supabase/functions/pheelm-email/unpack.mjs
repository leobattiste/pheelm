// Rebuilds each email's HTML and plain text from templates.compact.json (see scripts/compact-email-templates.mjs).
const PAD = '\u00a0\u200c\u200b\u200d\ufeff';
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
export function unpack(packed) {
  const out = {};
  for (const [id, t] of Object.entries(packed.templates)) {
    const l = packed.layouts[t.layout];
    const fill = (s, html) => s.split('[[PAD]]').join(PAD.repeat(t.pad)).split('[[TITLE_UPPER]]').join(t.title.toUpperCase())
      .split('[[TITLE]]').join(html ? escape(t.title) : t.title).split('[[BUTTON]]').join(html ? escape(t.button) : t.button);
    out[id] = { subject: t.subject, category: t.category, html: fill(l.html, true), text: fill(l.text, false) };
  }
  return out;
}
