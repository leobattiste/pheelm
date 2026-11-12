import fs from 'node:fs/promises';

// GoTrue calls the OTP sign-in template "magic_link" even when the email contains only a code.
export const authTemplates = [
  {name:'magic-link', key:'magic_link', subject:'Your Pheelm sign-in code', title:'Your sign-in code', message:'Enter this six-digit code on the Pheelm sign-in screen. Use the most recent code only. Never share it. If you did not request this email, you can ignore it.', code:true},
  {name:'confirm-signup', key:'confirmation', subject:'Confirm your Pheelm email', title:'Confirm your email', message:'Enter this six-digit code on Pheelm to confirm your email and finish creating your account. Never share it. If you did not create an account, you can ignore this email.', code:true},
  {name:'reset-password', key:'recovery', subject:'Your Pheelm password reset code', title:'Reset your password', message:'Enter this six-digit code on the Pheelm password reset screen, then choose your new password. Never share it. If you did not request a password reset, you can ignore this email.', code:true},
  {name:'reauthentication', key:'reauthentication', subject:'Your Pheelm verification code', title:'Confirm it is you', message:'Enter this six-digit code in Pheelm to confirm your identity before changing your password. Never share it. If you did not request this change, contact hey@pheelm.com.', code:true},
  {name:'confirm-email-change', key:'email_change', subject:'Confirm your Pheelm email change', title:'Confirm your new email', message:'Confirm the requested change to your Pheelm sign-in email. If you did not request this change, contact hey@pheelm.com.', actionUrl:'{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change', actionLabel:'Confirm email change'},
];

export async function authTemplateConfig() {
  const config = {};
  for (const template of authTemplates) {
    const html = await fs.readFile(new URL(`../supabase/email/${template.name}.html`, import.meta.url), 'utf8');
    if (template.code && (!html.includes('{{ .Token }}') || /\.ConfirmationURL|\.TokenHash|\.RedirectTo/.test(html))) {
      throw new Error(`${template.name} must contain an OTP code and no authentication link. Run node scripts/export-auth-emails.mjs first.`);
    }
    config[`mailer_subjects_${template.key}`] = template.subject;
    config[`mailer_templates_${template.key}_content`] = html;
  }
  return config;
}
