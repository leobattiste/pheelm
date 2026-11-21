// The email worker (supabase/functions/pheelm-email/index.ts) run with a fake database and a fake
// Resend: sends from Admin → Send carry their own subject, button and preview, escape what the admin
// wrote, link the right unsubscribe, mark tests, and skip a newsletter reader who left.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({ entryPoints: ['supabase/functions/pheelm-email/index.ts'], bundle: true, write: false, format: 'esm', platform: 'neutral', loader: { '.json': 'json' }, logLevel: 'silent' });
const code = out.outputFiles[0].text;

const MEMBER_TOKEN = 'a'.repeat(64), NEWS_TOKEN = 'b'.repeat(64);
const base = { attempts: 1, lease: 'lease', available_at: null, created_at: null, digest_from: null, digest_until: null, delivery: null };
const jobs = [
  { ...base, id: 'j1', user_id: 'u1', recipient: 'fan@example.com', template: 'campaign-announcement', category: 'announcement', campaign_id: 'c1',
    subject: 'Big <news> & more', action_label: 'See films', action_path: '/films', message: 'Line one <b>bold</b>\nLine two' },
  { ...base, id: 'j2', user_id: 'u2', recipient: 'admin@example.com', template: 'campaign-service', category: 'test', campaign_id: null,
    subject: 'Terms change', action_label: 'Open Pheelm', action_path: '/', message: 'From January.' },
  { ...base, id: 'j3', user_id: null, recipient: 'reader@example.com', template: 'campaign-newsletter', category: 'marketing', campaign_id: 'c2',
    subject: 'Discoveries', action_label: 'Explore', action_path: '/films', message: 'x'.repeat(300) },
  { ...base, id: 'j4', user_id: null, recipient: 'left@example.com', template: 'campaign-newsletter', category: 'marketing', campaign_id: 'c2',
    subject: 'Discoveries', action_label: 'Explore', action_path: '/films', message: 'Hi' },
  { ...base, id: 'j5', user_id: null, recipient: 'raw@example.com', template: 'newsletter', category: 'marketing', campaign_id: null,
    subject: null, action_label: null, action_path: '/', message: 'Not approved' },
  { ...base, id: 'j6', user_id: 'u3', recipient: 'old@example.com', template: 'welcome', category: 'transactional', campaign_id: null,
    subject: null, action_label: null, action_path: '/films', message: 'Welcome.' },
];
const sent = [], completed = [], rpcs = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith('https://api.resend.com/')) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: 'resend-' + sent.length }), { status: 200 }); }
  const name = url.split('/rpc/')[1], args = init.body ? JSON.parse(init.body) : {};
  rpcs.push(name);
  const reply = (v) => new Response(JSON.stringify(v), { status: 200 });
  if (name === 'email_delivery_config') return reply({ pheelm_resend_api_key: 'key', pheelm_email_worker_secret: 'secret' });
  if (name === 'email_prepare_digests') return new Response(null, { status: 204 });
  if (name === 'email_claim') return reply(jobs);
  if (name === 'email_job_preferences') return reply({ token: MEMBER_TOKEN });
  if (name === 'email_newsletter_token') return reply(args.address === 'reader@example.com' ? NEWS_TOKEN : null);
  if (name === 'email_complete') { completed.push(args); return new Response(null, { status: 204 }); }
  throw new Error('Unexpected call ' + url);
};
let handler;
globalThis.Deno = { env: { get: (k) => ({ SUPABASE_URL: 'https://db.test', SUPABASE_SERVICE_ROLE_KEY: 'service' })[k] }, serve: (h) => { handler = h; } };
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn) => realTimeout(fn, 0); // skip the pause between emails
await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const res = await handler(new Request('https://db.test/functions/v1/pheelm-email', { method: 'POST', headers: { Authorization: 'Bearer secret' } }));
assert.equal(res.status, 200);
assert.deepEqual(await res.json(), { sent: 4, failed: 1 });

const to = (address) => sent.find((m) => m.to[0] === address);
const ann = to('fan@example.com');
assert.equal(ann.subject, 'Big <news> & more', 'the admin’s subject, as written');
assert.match(ann.html, /Big &lt;news&gt; &amp; more/, 'subject escaped in the body');
assert.match(ann.html, /Line one &lt;b&gt;bold&lt;\/b&gt;<br>Line two/, 'message escaped, line breaks kept');
assert.match(ann.html, /See films/); assert.match(ann.html, /href="https:\/\/www\.pheelm\.com\/films"/);
assert.match(ann.html, new RegExp('/email\\?action=unsubscribe&amp;token=' + MEMBER_TOKEN));
assert.equal(ann.headers['List-Unsubscribe'], `<https://www.pheelm.com/email?action=unsubscribe&token=${MEMBER_TOKEN}>`);
assert.match(ann.text, /Big <news> & more/); assert.match(ann.text, /Line one <b>bold<\/b>\nLine two/);
assert.doesNotMatch(ann.html + ann.text, /\[\[[A-Z_]+\]\]/, 'every word filled in');

const test = to('admin@example.com');
assert.equal(test.subject, '[Test] Terms change');
assert.equal(test.headers, undefined, 'a test has no one-click unsubscribe');
assert.doesNotMatch(test.html, new RegExp(MEMBER_TOKEN), 'a test never carries the admin’s real unsubscribe link');
assert.match(test.html, /service notice/);
assert.doesNotMatch(test.html + test.text, /\[\[[A-Z_]+\]\]/);

const news = to('reader@example.com');
assert.match(news.html, new RegExp('token=' + NEWS_TOKEN), 'newsletter unsubscribe is the subscription’s');
assert.equal(news.headers['List-Unsubscribe'], `<https://www.pheelm.com/email?action=unsubscribe&token=${NEWS_TOKEN}>`);
assert.ok(/x{139}…/.test(news.html) && !/x{141}/.test(news.html.split('Discoveries')[0]), 'inbox preview is the start of the message');

assert.equal(to('left@example.com'), undefined, 'a reader who left is skipped');
assert.ok(completed.some((c) => c.job_id === 'j4' && c.failure === 'Unsubscribed before sending' && c.retryable === false));
assert.equal(to('raw@example.com'), undefined, 'a newsletter outside an approved send is refused');
assert.ok(completed.some((c) => c.job_id === 'j5' && c.failure));
assert.equal(to('old@example.com').subject, 'Welcome to Pheelm', 'existing emails keep their own subject');
console.log('PASS: the worker sends Admin → Send emails with their own subject, button and preview, escaped, with the right unsubscribe; tests are marked; unapproved or unsubscribed newsletters are not sent.');
