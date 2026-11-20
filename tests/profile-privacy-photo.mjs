// Going private must retire the old photo link, and must say so when it cannot.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const out = await build({ stdin: { contents: `export {photoForPrivacyChange, photoMoved} from './lib/profile-photo';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node', external: ['server-only', 'sharp'] });
const mod = { exports: {} };
vm.runInNewContext(out.outputFiles[0].text, { module: mod, exports: mod.exports, console, crypto, require: (n) => n === 'server-only' ? {} : require(n) });
const { photoForPrivacyChange, photoMoved } = mod.exports;

const USER = '11111111-2222-3333-4444-555555555555';
const PUBLIC = `https://x.supabase.co/storage/v1/object/public/avatars/${USER}/old.webp`;
const store = (opts = {}) => ({ storage: { from: () => ({
  download: async () => opts.unreadable ? { data: null, error: new Error('gone') } : { data: new Blob(['x']), error: null },
  upload: async () => ({ error: opts.unwritable ? new Error('full') : null }),
  getPublicUrl: (p) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/avatars/${p}` } }),
}) } });

// Going private moves the file, so the address people already have stops resolving.
const moved = await photoForPrivacyChange(store(), USER, { goingPrivate: true, photo: PUBLIC });
assert.ok(photoMoved(moved), 'going private should move the photo');
assert.equal(moved.old, `${USER}/old.webp`, 'the original is named for deletion');
assert.notEqual(moved.url, PUBLIC, 'the new address differs from the one already shared');
assert.ok(moved.url.includes(`${USER}/`), 'the new photo stays in the owner\'s folder');

// Nothing to do in the ordinary cases.
assert.equal(await photoForPrivacyChange(store(), USER, { goingPrivate: false, photo: PUBLIC }), null, 'staying public changes nothing');
assert.equal(await photoForPrivacyChange(store(), USER, { goingPrivate: true, photo: null }), null, 'no photo, nothing to move');
assert.equal(await photoForPrivacyChange(store(), USER, { goingPrivate: true, photo: 'https://elsewhere.example/p.jpg' }), null, 'a photo we do not host is left alone');
// Someone else's folder is never touched.
assert.equal(await photoForPrivacyChange(store(), USER, { goingPrivate: true, photo: PUBLIC.replace(USER, '99999999-0000-0000-0000-000000000000') }), null, 'another member\'s file is left alone');

// When the move fails the caller must be told, not handed a quiet success.
for (const broken of [{ unreadable: true }, { unwritable: true }]) {
  const result = await photoForPrivacyChange(store(broken), USER, { goingPrivate: true, photo: PUBLIC });
  assert.equal(JSON.stringify(result), '{"failed":true}', 'a failed move is reported: ' + JSON.stringify(broken));
  assert.equal(photoMoved(result), false, 'a failed move is not a move');
}
console.log('PASS: going private retires the old photo link, and a failed move is reported rather than hidden');
