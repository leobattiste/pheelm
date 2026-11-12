import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { authTemplates, authTemplateConfig } from '../scripts/auth-email-templates.mjs';
import { configureAuthEmails } from '../scripts/auth-email-config.mjs';

const expected = await authTemplateConfig();
assert.equal(Object.keys(expected).length, 10);
for (const template of authTemplates) {
  const html = expected[`mailer_templates_${template.key}_content`];
  assert.match(html, /<html[^>]*lang="en"/);
  assert.ok(Buffer.byteLength(html) < 102400);
  assert.doesNotMatch(html, /\[\[|<script|backdrop-filter/);
  if (template.code) {
    assert.equal((html.match(/{{ \.Token }}/g) ?? []).length, 1, `${template.name}: missing or duplicated code`);
    assert.doesNotMatch(html, /\.ConfirmationURL|\.TokenHash|\.RedirectTo/);
    assert.doesNotMatch(html, /<a[^>]+href="https?:/);
    assert.match(html, /Never share/);
  } else {
    assert.match(html, /type=email_change/);
  }
}

let requests = [];
let config = {smtp_host:'existing-smtp',smtp_pass:'test-secret-not-for-output',external_email_enabled:true};
const mockFetch = async (url, options) => {
  assert.match(url, /projects\/mvhwfmlairwrngdttzjh\/config\/auth$/);
  requests.push(options);
  if (options.method === 'PATCH') {
    const patch = JSON.parse(options.body);
    assert.deepEqual(Object.keys(patch).sort(), Object.keys(expected).sort(), 'unrelated Auth/SMTP settings changed');
    config = {...config, ...patch};
  }
  return {ok:true,json:async()=>config};
};
await assert.rejects(configureAuthEmails({fetchImpl:mockFetch}), /management access/);
assert.equal(requests.length, 0);
await assert.rejects(configureAuthEmails({token:'test',check:true,fetchImpl:mockFetch}), /differ/);
assert.ok(!requests.some(request => request.method === 'PATCH'), 'check mode wrote configuration');
requests = [];
assert.equal((await configureAuthEmails({token:'test',fetchImpl:mockFetch})).verifiedTemplates, 5);
assert.equal(config.smtp_host, 'existing-smtp');
assert.equal(config.smtp_pass, 'test-secret-not-for-output');
assert.equal(requests.length, 3, 'configuration was not read back after updating');
await configureAuthEmails({token:'test',check:true,fetchImpl:mockFetch});
await assert.rejects(configureAuthEmails({token:'test',fetchImpl:async()=>({ok:false,status:403})}), /403/);

const before = await fs.readFile('supabase/email/magic-link.html', 'utf8');
await import('../scripts/export-auth-emails.mjs');
assert.equal(await fs.readFile('supabase/email/magic-link.html', 'utf8'), before, 'regeneration changed the code template');
console.log('PASS: code-only Auth templates, repeatable export, correct Supabase keys, management access, SMTP preservation and post-update verification.');
