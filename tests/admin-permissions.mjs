// Every admin server action checks who's calling before it does anything, owner-only actions
// check for the owner, and admin pages check for an admin. Run: node tests/admin-permissions.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(join(root, 'app/admin')).filter((f) => /\.(ts|tsx)$/.test(f));

// Actions only the owner may run, and the files they live in.
const OWNER_ONLY = {
  'app/admin/actions.ts': ['deleteFilm', 'setAdmin'],
  'app/admin/inbox/actions.ts': ['removeSubscriber'],
  'app/admin/community/actions.ts': ['deleteWatchlist'],
};
// Actions that only call other checked actions in this file.
const DELEGATES = { 'app/admin/actions.ts': { addMany: 'addOne', importMany: 'importOne' } };

let actions = 0;
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  if (/^["']use server["']/.test(source.trim())) {
    for (const part of source.split(/\nexport async function /).slice(1)) {
      const name = part.split('(')[0];
      const body = part.split(/\n}\n/)[0];
      actions++;
      const delegate = DELEGATES[rel]?.[name];
      if (delegate) { assert(body.includes(`${delegate}(`), `${rel} ${name} should only call ${delegate}`); continue; }
      const guard = ['ownerClient(', 'adminClient(', 'requireAdmin('].find((g) => body.includes(g));
      assert(guard, `${rel} ${name} doesn't check who's calling`);
      // The check comes before any database work.
      const first = body.search(/\b(?:db|admin|service)\.(?:from|rpc|auth)\b/);
      if (first !== -1) assert(body.indexOf(guard) < first, `${rel} ${name} uses the database before checking access`);
      if (OWNER_ONLY[rel]?.includes(name)) assert(body.includes('ownerClient(') && !body.includes('adminClient('), `${rel} ${name} must be owner-only`);
      assert(body.includes('logAdminActivity('), `${rel} ${name} doesn't record itself in the activity log`);
    }
  }
  // Every admin page checks for an admin itself (the layout's check doesn't cover server actions or direct renders).
  if (rel.endsWith('page.tsx') && !rel.includes('[box]') && !/^app\/admin\/inbox\/page\.tsx$/.test(rel)) {
    assert(source.includes('requireAdmin('), `${rel} doesn't check for an admin`);
  }
}
for (const [rel, names] of Object.entries(OWNER_ONLY)) {
  const source = readFileSync(join(root, rel), 'utf8');
  for (const name of names) assert(source.includes(`export async function ${name}(`), `${rel} no longer has ${name}`);
}
// The CSV of subscriber addresses is owner-only.
assert(readFileSync(join(root, 'app/admin/subscribers.csv/route.ts'), 'utf8').includes('ownerClient()'), 'subscriber CSV must be owner-only');
// The inbox list and boxes are rendered by InboxList, which checks for an admin.
assert(readFileSync(join(root, 'app/admin/inbox/InboxList.tsx'), 'utf8').includes('requireAdmin('), 'InboxList must check for an admin');
// Service-role access stays on the server.
for (const file of walk(join(root, 'app')).concat(walk(join(root, 'components')))) {
  if (!/\.(ts|tsx)$/.test(file)) continue;
  const source = readFileSync(file, 'utf8');
  if (/^["']use client["']/.test(source.trim())) assert(!source.includes('supabase/service') && !source.includes('SERVICE_ROLE'), `${relative(root, file)} is client code reaching for the service role`);
}
console.log(`PASS: ${actions} admin actions check access first and are logged, owner-only actions stay owner-only, and every admin page checks for an admin.`);
