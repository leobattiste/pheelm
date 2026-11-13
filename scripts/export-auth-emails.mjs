// Writes the Supabase Auth email templates (paste them into Authentication → Email Templates, or run scripts/auth-email-config.mjs).
// Same design as every other Pheelm email. Supabase fills in {{ .Token }}, {{ .RedirectTo }} and {{ .TokenHash }}.
// The year is the year this is run: run `npm run email:preview` each January and paste again.
import { catalog, withEmail, staticProps, write } from './lib/email.mjs';

const year = String(new Date().getFullYear());
const LINKS = { 'sign-in': ['magic-link', 'email'], 'confirm-signup': ['confirm-signup', 'email'], 'confirm-email-change': ['confirm-email-change', 'email_change'], 'reset-password': ['reset-password', 'recovery'] };
await withEmail(async ({ html }) => {
  for (const t of catalog.filter((t) => t.id in LINKS)) {
    const [name, type] = LINKS[t.id];
    await write(`supabase/email/${name}.html`, await html({
      ...staticProps(t), message: t.authMessage ?? t.message, year,
      actionUrl: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`,
      ...(t.id === 'confirm-email-change' ? {} : { code: '{{ .Token }}' }),
    }));
  }
  console.log('Exported four Supabase Auth templates with one-time codes and destination-preserving links.');
});
