// Renders every email in emails/catalog.json:
//   email-previews/*.html and *.txt  (gitignored, for looking at)
//   supabase/functions/pheelm-email/templates.compact.json  (what the worker sends: two shared layouts + each email's words)
//   supabase/functions/pheelm-email/templates.json          (the same, unpacked in full, for tests)
// Run with `npm run email:preview`, then deploy the worker.
import fs from 'node:fs/promises';
import { catalog, withEmail, hasUnsubscribe, staticProps, write, file } from './lib/email.mjs';
import { unpack, FIELDS } from '../supabase/functions/pheelm-email/unpack.mjs';

const year = String(new Date().getFullYear());
await withEmail(async ({ html, text }) => {
  await fs.mkdir(file('email-previews/'), { recursive: true });
  const layouts = [], templates = {};
  for (const t of catalog) {
    if (![0, 3].includes(t.rows?.length ?? -1) || !t.note || !t.preheader) throw new Error(`${t.id}: needs a preheader, three rows or none, and a note`);
    const optional = hasUnsubscribe(t);
    // A look at it, with real words.
    const sample = { ...staticProps(t), message: t.message, actionUrl: 'https://www.pheelm.com/account', year, pad: '', code: t.category === 'auth' && t.id !== 'confirm-email-change' ? '482 913' : undefined, ...(optional ? { unsubscribeUrl: 'https://www.pheelm.com/account?tab=notifications', postalAddress: 'Postal address is set before marketing sends.' } : {}) };
    await write(`email-previews/${t.id}.html`, await html(sample));
    await write(`email-previews/${t.id}.txt`, await text(sample));
    // What the worker sends: every word that comes from the catalog is a token, so all emails share one layout.
    // A guide is part of the email's own layout (its words are fixed), so it's written out, not tokenised.
    const tokens = { guide: t.guide ?? [], title: '[[TITLE]]', preheader: '[[PREHEADER]]', rows: t.rows.length ? [['[[L1]]', '[[T1]]'], ['[[L2]]', '[[T2]]'], ['[[L3]]', '[[T3]]']] : [], note: '[[NOTE]]', actionLabel: '[[BUTTON]]', message: '[[MESSAGE]]', actionUrl: '[[ACTION_URL]]', year: '[[YEAR]]', pad: '[[PAD]]', ...(optional ? { unsubscribeUrl: '[[UNSUBSCRIBE_URL]]', postalAddress: '[[POSTAL_ADDRESS]]' } : {}) };
    const layout = { html: await html(tokens), text: await text(tokens) };
    let index = layouts.findIndex((l) => l.html === layout.html && l.text === layout.text);
    if (index < 0) index = layouts.push(layout) - 1;
    templates[t.id] = { subject: t.subject, category: t.category, layout: index, fields: Object.fromEntries(FIELDS.map((f) => [f, f === 'TITLE' ? t.title : f === 'PREHEADER' ? t.preheader : f === 'BUTTON' ? t.button : f === 'NOTE' ? t.note : f[0] === 'L' ? (t.rows[Number(f[1]) - 1]?.[0] ?? '') : (t.rows[Number(f[1]) - 1]?.[1] ?? '')])) };
  }
  // Store markup the layouts repeat once, as `parts`: what every layout starts and ends with, then
  // the wrappers used throughout. unpack() expands them; the check below proves nothing changed.
  const common = (strs, fromEnd) => { let n = 0; const get = (x, i) => fromEnd ? x[x.length - 1 - i] : x[i]; while (strs.every((x) => n < x.length && get(x, n) === get(strs[0], n))) n++; return fromEnd ? strs[0].slice(strs[0].length - n) : strs[0].slice(0, n); };
  const htmls = layouts.map((l) => l.html);
  const parts = [common(htmls, false), common(htmls, true),
    '<span class="gm-s" style="display:block"><span class="gm-d" style="display:block">',
    '<table align="center" width="100%" border="0" cellPadding="0" cellSpacing="0" role="presentation"',
    'margin-top:0;margin-right:0;margin-bottom:0;margin-left:0', ';margin-top:0;margin-bottom:0;margin-left:0;margin-right:0',
    '<tbody style="width:100%"><tr style="width:100%"><td data-id="__react-email-column" style="padding:',
    'style="color:#ffffff;text-decoration-line:none;text-decoration:underline" target="_blank"',
    '</span></span></p>', 'font-size:12px;line-height:19px;color:#9a9a9a;margin:0 0 10px'].filter((x) => x.length > 20);
  const pack = (str) => parts.reduce((acc, part, i) => acc.split(part).join(`{%${i}%}`), str);
  if (layouts.some((l) => /\{%\d+%\}/.test(l.html + l.text))) throw new Error('A layout already contains {%n%}');
  const packed = { parts, layouts: layouts.map((l) => ({ html: pack(l.html), text: l.text })), templates };
  const back = unpack(packed), plain = unpack({ layouts, templates });
  for (const id of Object.keys(templates)) if (back[id].html !== plain[id].html || back[id].text !== plain[id].text) throw new Error('Packing changed ' + id);
  await write('supabase/functions/pheelm-email/templates.compact.json', JSON.stringify(packed) + '\n');
  await write('supabase/functions/pheelm-email/templates.json', JSON.stringify(unpack(packed), null, 2) + '\n');
  console.log(`Rendered ${catalog.length} HTML and plain-text previews (${layouts.length} shared layouts).`);
});
