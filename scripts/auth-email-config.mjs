/** Auth template setup. SMTP changes are opt-in; credentials never enter the output. */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { authTemplateConfig } from './auth-email-templates.mjs';

export async function configureAuthEmails({token, smtpKey, check = false, backupPath, fetchImpl = fetch} = {}) {
  if (!token) throw new Error('Auth email settings require Supabase management access. Set SUPABASE_ACCESS_TOKEN securely in your local environment, or paste the templates in the Supabase dashboard. Do not paste tokens into chat.');
  const url = 'https://api.supabase.com/v1/projects/mvhwfmlairwrngdttzjh/config/auth';
  const headers = {Authorization:`Bearer ${token}`, 'Content-Type':'application/json'};
  const expected = await authTemplateConfig();
  const read = async () => {
    const response = await fetchImpl(url, {headers});
    if (!response.ok) throw new Error(`Cannot read Auth settings (${response.status}). Check management access.`);
    return response.json();
  };
  const before = await read();
  if (!check) {
    // Back up only the templates being edited, never SMTP credentials or other settings.
    if (backupPath) await fs.writeFile(backupPath, JSON.stringify(Object.fromEntries(Object.keys(expected).map(key => [key, before[key]])), null, 2), {mode:0o600, flag:'wx'});
    const patch = {...expected, ...(smtpKey ? {smtp_admin_email:'notifications@pheelm.com',smtp_host:'smtp.resend.com',smtp_port:'465',smtp_user:'resend',smtp_pass:smtpKey,smtp_sender_name:'Pheelm'} : {})};
    const response = await fetchImpl(url, {method:'PATCH', headers, body:JSON.stringify(patch)});
    if (!response.ok) throw new Error(`Auth email configuration failed (${response.status}). Existing settings were not verified; inspect the dashboard before retrying.`);
  }
  const actual = check ? before : await read();
  const mismatched = Object.keys(expected).filter(key => actual[key] !== expected[key]);
  if (mismatched.length) throw new Error(`Auth email settings differ from the prepared templates: ${mismatched.join(', ')}.`);
  return {verifiedTemplates:5, smtpChanged:!check && !!smtpKey};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const smtp = process.argv.includes('--smtp');
  if (smtp && !process.env.RESEND_API_KEY) throw new Error('Set RESEND_API_KEY securely before using --smtp.');
  const result = await configureAuthEmails({token:process.env.SUPABASE_ACCESS_TOKEN, smtpKey:smtp ? process.env.RESEND_API_KEY : undefined, check:process.argv.includes('--check'), backupPath:process.env.AUTH_TEMPLATE_BACKUP_PATH});
  console.log(`Verified ${result.verifiedTemplates} Supabase Auth email templates. ${result.smtpChanged ? 'SMTP updated.' : 'SMTP settings preserved.'}`);
}
