import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = fs.readFileSync('lib/sentry-scrub.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const sandbox = { exports: {}, process: { env: {} } };
vm.runInNewContext(code, sandbox);
const { scrubEvent, scrubBreadcrumb, IGNORED_ERRORS, SENTRY_DSN, SENTRY_ON } = sandbox.exports;

// Cookies, headers, bodies, query strings and personal details never leave the site.
const event = scrubEvent({
  exception: { values: [{ type: 'Error', value: 'boom' }] },
  request: { url: 'https://www.pheelm.com/auth/callback?code=secret&next=/me#x', cookies: { a: 'b' }, headers: { cookie: 'sb=1', authorization: 'Bearer x' }, data: { password: 'p' }, query_string: 'code=secret' },
  user: { id: 'u1', email: 'a@b.co', username: 'leo', ip_address: '1.2.3.4' },
  breadcrumbs: [{ category: 'navigation', data: { from: '/films?q=secret', to: '/me?token=x' } }, { category: 'fetch', data: { url: 'https://x.test/api?key=1' } }],
});
assert.equal(event.request.url, 'https://www.pheelm.com/auth/callback');
for (const k of ['cookies', 'headers', 'data', 'query_string']) assert.equal(event.request[k], undefined, k);
assert.equal(JSON.stringify(event.user), '{"id":"u1"}');
assert.equal(event.breadcrumbs[0].data.from, '/films');
assert.equal(event.breadcrumbs[0].data.to, '/me');
assert.equal(event.breadcrumbs[1].data.url, 'https://x.test/api');
assert.equal(scrubEvent({ user: { email: 'a@b.co' } }).user, undefined);

// Page-left-open-across-an-update and redirect noise is dropped; a real error is kept.
assert.equal(scrubEvent({ exception: { values: [{ type: 'ChunkLoadError', value: 'Loading chunk 12 failed' }] } }), null);
assert.equal(scrubEvent({ exception: { values: [{ type: 'Error', value: 'NEXT_REDIRECT' }] } }), null);
assert.notEqual(scrubEvent({ exception: { values: [{ type: 'TypeError', value: 'x is undefined' }] } }), null);
assert.ok(IGNORED_ERRORS.length >= 5);

// Typed words are never kept as a breadcrumb.
const crumb = scrubBreadcrumb({ category: 'ui.input', message: 'input[name=password]', data: { url: '/login?next=/me' } });
assert.equal(crumb.message, undefined);
assert.equal(crumb.data.url, '/login');

// Reports go to Pheelm's project, and only from the live site.
assert.match(SENTRY_DSN, /^https:\/\/[0-9a-f]{32}@o\d+\.ingest\.us\.sentry\.io\/\d+$/);
assert.equal(SENTRY_ON, false);
for (const f of ['sentry.server.config.ts', 'sentry.edge.config.ts', 'instrumentation-client.ts']) {
  const t = fs.readFileSync(f, 'utf8');
  assert.match(t, /enabled: SENTRY_ON/, f);
  assert.doesNotMatch(t, /replayIntegration|replaysSessionSampleRate/, f + ' records no sessions');
}
assert.match(fs.readFileSync('instrumentation.ts', 'utf8'), /onRequestError = Sentry\.captureRequestError/);
console.log('PASS: Error reports drop cookies, headers, bodies, query strings and personal details, skip update noise, and send only from the live site.');
