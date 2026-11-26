// The donation flow: amounts are checked on the server, the Stripe request asks for the right thing,
// no secret key is in the code, and the page falls back to the payment link without keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const src = fs.readFileSync('lib/donate.ts', 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { parseDonation, checkoutParams, DONATION_NAME } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

assert.deepEqual(parseDonation({ amount: 25 }), { cents: 2500, monthly: false });
assert.deepEqual(parseDonation({ amount: 5, monthly: true }), { cents: 500, monthly: true });
for (const bad of [null, 'x', {}, { amount: 0 }, { amount: 1001 }, { amount: 2.5 }, { amount: '25' }, { amount: -5 }, { amount: NaN }, { amount: 5, monthly: 'yes' }]) {
  assert.equal(parseDonation(bad), null, `rejects ${JSON.stringify(bad)}`);
}

const once = checkoutParams({ cents: 2500, monthly: false }, 'https://x.test/donate?thanks=1');
assert.equal(once.get('mode'), 'payment');
assert.equal(once.get('ui_mode'), 'embedded_page');
assert.equal(once.get('submit_type'), 'donate');
assert.equal(once.get('line_items[0][price_data][unit_amount]'), '2500');
assert.equal(once.get('line_items[0][price_data][product_data][name]'), DONATION_NAME);
assert.equal(once.get('line_items[0][price_data][recurring][interval]'), null);
assert.equal(once.get('return_url'), 'https://x.test/donate?thanks=1');
const monthly = checkoutParams({ cents: 500, monthly: true }, 'https://x.test/donate?thanks=1');
assert.equal(monthly.get('mode'), 'subscription');
assert.equal(monthly.get('line_items[0][price_data][recurring][interval]'), 'month');
assert.equal(monthly.get('submit_type'), null, 'submit_type is for one-time payments only');

const route = fs.readFileSync('app/api/donate/session/route.ts', 'utf8');
assert.match(route, /process\.env\.STRIPE_SECRET_KEY/);
assert.match(route, /status: 503/, 'says so when the keys are not set');
assert.doesNotMatch(route + src + fs.readFileSync('components/DonateCheckout.tsx', 'utf8'), /sk_(live|test)_|rk_(live|test)_/);
const page = fs.readFileSync('app/donate/page.tsx', 'utf8');
assert.match(page, /STRIPE_SECRET_KEY \? process\.env\.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/, 'the picker needs both keys');
assert.match(page, /href=\{DONATE_URL\}/, 'falls back to the payment link');
console.log('PASS: donation amounts are validated, the Stripe request is right, and the page falls back without keys.');
// A failure is shown on the page with a short code (never Stripe's message, which can quote a key).
assert.match(route, /why/); assert.doesNotMatch(route, /NextResponse\.json\(\{[^}]*json\.error\?\.message/);
assert.match(fs.readFileSync('components/DonateCheckout.tsx', 'utf8'), /fetchClientSecret: async \(\) => secret/);
assert.match(fs.readFileSync("components/DonateCheckout.tsx", "utf8"), /embedded\?\.destroy\(\)/);
// Works whichever name the account's API version uses for the embedded mode.
assert.match(route, /param !== "ui_mode"/); assert.match(route, /older\.set\("ui_mode", "embedded"\)/);
