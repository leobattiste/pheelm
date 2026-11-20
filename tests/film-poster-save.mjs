// A save must never erase a poster that the form did not know about.
import { build } from 'esbuild';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const out = await build({ stdin: { contents: `export {resolvePoster} from './lib/film-fields';`, loader: 'ts', resolveDir: process.cwd() }, bundle: true, write: false, format: 'cjs', platform: 'node' });
const mod = { exports: {} };
vm.runInNewContext(out.outputFiles[0].text, { module: mod, exports: mod.exports, console });
const { resolvePoster } = mod.exports;

const OLD = 'https://image.tmdb.org/t/p/w500/old.jpg';
const NEW = 'https://image.tmdb.org/t/p/w500/new.jpg';
const UP = 'https://pheelm.example/storage/posters/upload.webp';

// The bug: an import filled the poster in after the page opened, so the form sent an empty box.
assert.equal(resolvePoster({ typed: '', previous: OLD }), OLD, 'an empty box must not erase a poster');
assert.equal(resolvePoster({ typed: null, previous: OLD }), OLD, 'a missing field must not erase a poster');
// The same after a file upload, which the form's own poster box never sees.
assert.equal(resolvePoster({ typed: '', previous: UP }), UP, 'saving twice after an upload keeps the uploaded poster');

// What should still work.
assert.equal(resolvePoster({ typed: NEW, previous: OLD }), NEW, 'a typed link replaces the poster');
assert.equal(resolvePoster({ uploaded: UP, typed: OLD, previous: OLD }), UP, 'an upload wins over the typed link');
assert.equal(resolvePoster({ typed: '', previous: OLD, remove: true }), null, 'Remove poster erases it');
assert.equal(resolvePoster({ uploaded: UP, remove: true }), UP, 'uploading and removing at once keeps the new poster');
assert.equal(resolvePoster({ typed: '', previous: '' }), null, 'a film with no poster stays without one');
console.log('PASS: an empty poster box leaves the saved poster alone; only Remove poster clears it');
