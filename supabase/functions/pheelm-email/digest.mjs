// The Digest's list of what's new: films as a grid of posters, then directors and public watchlists.
// Used by the worker when it sends a Digest, and by the preview script. Dark, with white type, like
// every Pheelm email: backgrounds are also painted as images and text is wrapped in the Gmail
// blend layers (see emails/PheelmEmail.tsx), so the Gmail app's dark mode doesn't turn it pale.
// Every value is escaped; images only come from TMDB over https.
const SITE = 'https://www.pheelm.com';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (path) => (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? SITE + path : SITE);
/** A TMDB image at a size that suits email, or null for anything else. */
export function tmdbImage(url, size) {
  const m = typeof url === 'string' && /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+(\/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|webp))$/.exec(url);
  return m ? `https://image.tmdb.org/t/p/${size}${m[1]}` : null;
}

const font = 'font-family:Arial, Helvetica, sans-serif;';
const INSET = '#262626';
const paint = (color) => `background-color:${color};background-image:linear-gradient(${color},${color});`;
/** Text that keeps its colour in Gmail's dark mode. */
const g = (html) => `<span class="gm-s" style="display:block"><span class="gm-d" style="display:block">${html}</span></span>`;
const heading = (label, total, shown) => `<tr><td style="padding:26px 0 12px;${font}">${g(`<span style="font-size:18px;line-height:24px;font-weight:700;color:#ffffff">${esc(label)}</span><span style="font-size:13px;line-height:24px;color:#9a9a9a">&nbsp;&nbsp;${total > shown ? `${shown} of ${total} new` : `${total} new`}</span>`)}</td></tr>`;

function films(section) {
  const items = section.items;
  const cells = items.map((f) => {
    const poster = tmdbImage(f.poster, 'w185');
    const art = poster
      ? `<img src="${esc(poster)}" width="160" alt="${esc(f.title)} poster" style="display:block;width:100%;max-width:160px;height:auto;border:0;border-radius:10px;background:${INSET}">`
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="230" style="height:230px;${paint(INSET)}border-radius:10px;padding:10px;vertical-align:bottom;${font}font-size:13px;line-height:17px;color:#b8b8b8">${g(esc(f.title))}</td></tr></table>`;
    return `<td width="33%" valign="top" style="width:33%;padding:0 6px 18px;vertical-align:top"><a href="${esc(link(f.path))}" target="_blank" style="text-decoration:none;color:#ffffff">${art}${g(`<span style="display:block;padding-top:8px;${font}font-size:14px;line-height:19px;font-weight:700;color:#ffffff">${esc(f.title)}</span>${f.year ? `<span style="display:block;${font}font-size:13px;line-height:18px;color:#9a9a9a">${esc(f.year)}</span>` : ''}`)}</a></td>`;
  });
  const rows = [];
  for (let i = 0; i < cells.length; i += 3) rows.push(`<tr>${cells.slice(i, i + 3).join('')}${'<td width="33%" style="width:33%"></td>'.repeat(3 - cells.slice(i, i + 3).length)}</tr>`);
  return heading('Films', section.total, items.length) + `<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join('')}</table></td></tr>`;
}

function people(section) {
  return heading('Directors', section.total, section.items.length) + section.items.map((p) => {
    const photo = tmdbImage(p.photo, 'w185');
    const face = photo
      ? `<img src="${esc(photo)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;border-radius:22px;object-fit:cover;background:${INSET}">`
      : `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" height="44" align="center" style="width:44px;height:44px;border-radius:22px;${paint(INSET)}${font}font-size:17px;font-weight:700;color:#ffffff">${g(esc((p.title || '?').trim().charAt(0).toUpperCase()))}</td></tr></table>`;
    return `<tr><td style="padding:0 0 12px"><a href="${esc(link(p.path))}" target="_blank" style="text-decoration:none;color:#ffffff"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" style="width:44px;vertical-align:middle">${face}</td><td style="padding-left:12px;vertical-align:middle;${font}font-size:15px;line-height:20px;font-weight:700;color:#ffffff">${g(esc(p.title))}</td></tr></table></a></td></tr>`;
  }).join('');
}

function lists(section) {
  return heading('Watchlists', section.total, section.items.length) + section.items.map((l) =>
    `<tr><td style="padding:0 0 10px;${font}font-size:15px;line-height:21px">${g(`<a href="${esc(link(l.path))}" target="_blank" style="color:#ffffff;font-weight:700;text-decoration:underline">${esc(l.title)}</a>`)}</td></tr>`).join('');
}

/** The HTML that goes under the opening line of a Digest. */
export function digestHtml(data) {
  const has = (s) => Array.isArray(s?.items) && s.items.length > 0;
  const parts = [has(data.films) && films(data.films), has(data.directors) && people(data.directors), has(data.watchlists) && lists(data.watchlists)].filter(Boolean);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px">${parts.join('')}</table>`;
}

/** The same list for the plain-text version. */
export function digestText(data) {
  const out = [];
  const section = (label, s, line) => { if (!Array.isArray(s?.items) || !s.items.length) return; out.push(`${label} (${s.total} new)`); for (const i of s.items) out.push(line(i)); out.push(''); };
  section('Films', data.films, (f) => `${f.title}${f.year ? ` (${f.year})` : ''}: ${link(f.path)}`);
  section('Directors', data.directors, (p) => `${p.title}: ${link(p.path)}`);
  section('Watchlists', data.watchlists, (l) => `${l.title}: ${link(l.path)}`);
  return out.join('\n').trim();
}

/** The opening line, which depends on how often the member chose to hear from us. */
export function digestIntro(frequency) {
  return frequency === 'daily' ? 'Here’s what was added to Pheelm since yesterday’s Digest.' : 'Here’s what was added to Pheelm this week.';
}
