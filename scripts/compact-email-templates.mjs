// Packs supabase/functions/pheelm-email/templates.json into templates.compact.json for the worker:
// every template shares one of two layouts (with or without the unsubscribe footer), so only the
// layouts and each template's words are stored. Run by `npm run email:preview`. Fails if unpacking
// wouldn't give back exactly the same HTML and text.
import fs from 'node:fs/promises';
import { unpack } from '../supabase/functions/pheelm-email/unpack.mjs';
const dir = new URL('../supabase/functions/pheelm-email/', import.meta.url);
const full = JSON.parse(await fs.readFile(new URL('templates.json', dir), 'utf8'));
const catalog = Object.fromEntries(JSON.parse(await fs.readFile(new URL('../emails/catalog.json', import.meta.url), 'utf8')).map((t) => [t.id, t]));
const PAD = ' ‌​‍﻿';
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const layouts = [], templates = {};
for (const [id, t] of Object.entries(full)) {
  const { title, button } = catalog[id];
  const pad = (t.html.match(new RegExp(`(?:${PAD})+`)) ?? [''])[0].length / PAD.length;
  const html = t.html.replace(new RegExp(`(?:${PAD})+`), '[[PAD]]').replaceAll(escape(title), '[[TITLE]]').replaceAll(escape(button), '[[BUTTON]]');
  const text = t.text.replaceAll(title.toUpperCase(), '[[TITLE_UPPER]]').replaceAll(title, '[[TITLE]]').replaceAll(button, '[[BUTTON]]');
  let layout = layouts.findIndex((l) => l.html === html && l.text === text);
  if (layout < 0) layout = layouts.push({ html, text }) - 1;
  templates[id] = { subject: t.subject, category: t.category, title, button, pad, layout };
}
const packed = { layouts, templates };
const back = unpack(packed);
for (const id of Object.keys(full)) {
  if (back[id].html !== full[id].html || back[id].text !== full[id].text || back[id].subject !== full[id].subject || back[id].category !== full[id].category) throw new Error('Packing changed ' + id);
}
await fs.writeFile(new URL('templates.compact.json', dir), JSON.stringify(packed) + '\n');
console.log(`Packed ${Object.keys(full).length} templates into ${layouts.length} layouts.`);
