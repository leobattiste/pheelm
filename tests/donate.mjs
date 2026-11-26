import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('app/donate/page.tsx', 'utf8');
const site = fs.readFileSync('lib/site.ts', 'utf8');
const header = fs.readFileSync('components/SiteHeader.tsx', 'utf8');
const account = fs.readFileSync('app/account/page.tsx', 'utf8');
const button = fs.readFileSync('components/PayPalDonate.tsx', 'utf8');

// The Donate page shows PayPal's hosted Donate button (card, PayPal, Venmo).
assert.match(site, /PAYPAL_BUTTON_ID = process\.env\.NEXT_PUBLIC_PAYPAL_BUTTON_ID \?\? "[A-Z0-9]+"/);
assert.match(page, /<PayPalDonate buttonId=\{PAYPAL_BUTTON_ID\} \/>/);
assert.match(page, /Donations open soon/);
assert.match(button, /components=hosted-buttons/);
assert.match(button, /enable-funding=venmo/);
assert.match(button, /HostedButtons\(\{ hostedButtonId: buttonId \}\)\.render\(el\)/);
assert.doesNotMatch(button, /client-secret|secret=/i, 'only the public client id');
// The security policy lets PayPal's script run.
assert.match(fs.readFileSync('next.config.ts', 'utf8'), /script-src[^`]*https:\/\/www\.paypal\.com/);
// Honest about tax status, matching the terms; a thank-you when donors come back.
assert.match(page, /not a tax-exempt charity/);
assert.match(page, /thanks !== undefined/);
// The menu opens the Donate page; Settings and Donate link to PayPal to manage a monthly gift.
assert.match(header, /<Link href="\/donate"[^>]*>.*Donate<\/Link>/);
assert.match(site, /DONATION_PORTAL_URL = process\.env\.NEXT_PUBLIC_DONATION_PORTAL_URL \|\| "https:\/\/www\.paypal\.com\//);
assert.match(account, /href=\{DONATION_PORTAL_URL\}>Manage in PayPal</);
assert.match(page, /href=\{DONATION_PORTAL_URL\}/);
console.log('PASS: The Donate page shows PayPal’s Donate button, and Settings links to PayPal to manage a monthly gift.');
