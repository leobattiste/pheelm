// Who's signed in comes from the session token (checked against the signing keys), not from a
// call to the sign-in service, so a busy service no longer shows members as signed out.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const out = await build({ stdin: { contents: `export { getViewer } from './lib/supabase/server';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', external: ['next/headers', '@supabase/ssr'] });
const mod = { exports: {} };
vm.runInNewContext(out.outputFiles[0].text, { module: mod, exports: mod.exports, require: () => ({}), process: { env: {} } });
const { getViewer } = mod.exports;

let userCalls = 0;
const client = (claims) => ({ auth: { getClaims: claims, getUser: async () => { userCalls++; return { data: { user: null }, error: { status: 500 } }; } } });

const v = await getViewer(client(async () => ({ data: { claims: { sub: 'u1', email: 'a@b.c', user_metadata: { has_password: true }, app_metadata: { provider: 'email' } } }, error: null })));
assert.deepEqual(JSON.parse(JSON.stringify(v)), { id: 'u1', email: 'a@b.c', user_metadata: { has_password: true }, app_metadata: { provider: 'email' } });
assert.equal(userCalls, 0, 'the sign-in service is not asked');
assert.equal(await getViewer(client(async () => ({ data: null, error: { message: 'no session' } }))), null, 'no session: signed out');
assert.equal(await getViewer(client(async () => { throw new Error('network'); })), null, 'a failure never throws into the page');
assert.equal(await getViewer(null), null);
console.log('PASS: the viewer comes from the session token, without asking the sign-in service');
