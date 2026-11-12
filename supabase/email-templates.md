# Pheelm authentication emails

Email-and-password sign-in remains available. Signup confirmation, optional code sign-in,
password recovery and password-change verification use six-digit codes.

## Why requesting a code can still send a magic link

Supabase uses `signInWithOtp` for both magic links and email codes. The **live Supabase
email template** determines the email's content. Its dashboard section is named **Magic
Link** even when the template sends a code. Deploying Pheelm or editing a Resend template
does not update that Supabase setting.

The default template contains `{{ .ConfirmationURL }}` but no `{{ .Token }}`, so the
app's code screen receives a link-only email. Pheelm's code templates contain
`{{ .Token }}` and no authentication links.

## Apply in the dashboard

In the **Pheelm** project (`mvhwfmlairwrngdttzjh`), open **Authentication → Emails →
Templates** (called **Email Templates** in some dashboard versions). Set and save each:

| Template | Subject | HTML file |
| --- | --- | --- |
| Magic Link | Your Pheelm sign-in code | `supabase/email/magic-link.html` |
| Confirm signup | Confirm your Pheelm email | `supabase/email/confirm-signup.html` |
| Reset password | Your Pheelm password reset code | `supabase/email/reset-password.html` |
| Reauthentication | Your Pheelm verification code | `supabase/email/reauthentication.html` |
| Change email address | Confirm your Pheelm email change | `supabase/email/confirm-email-change.html` |

For a minimal immediate fix, replace **Magic Link** with:

```html
<h2>Your Pheelm sign-in code</h2>
<p>Enter this six-digit code on Pheelm:</p>
<p style="font:32px monospace;letter-spacing:4px">{{ .Token }}</p>
<p>Never share this code. If you did not request it, ignore this email.</p>
```

Use the complete HTML files for the branded version. Changing email addresses still uses
the existing confirmation-link flow; the app does not have an email-change code screen.

## Apply using management access

After making `SUPABASE_ACCESS_TOKEN` available securely in your local environment:

```sh
node scripts/export-auth-emails.mjs
node scripts/auth-email-config.mjs
node scripts/auth-email-config.mjs --check
```

This updates and verifies only the five templates and subjects. It preserves passwords,
users, sessions, SMTP credentials, redirect URLs and other Auth settings. Optionally set
`AUTH_TEMPLATE_BACKUP_PATH` to a new local file to back up the previous template fields.
The script never prints the management token or SMTP credentials.

Only use `--smtp` with `RESEND_API_KEY` also configured securely if explicitly setting up
SMTP. Routine template fixes do not require a Resend key. Never commit or paste tokens.

Regenerate with `export-auth-emails.mjs`; do not hand-edit generated HTML. The exporter
uses the shared React Email layout and keeps the code-only behavior on every run.

## Auth settings and verification

- Keep the Email provider and Confirm email enabled, minimum password length at least
  eight, and email OTP length **six**, matching the form. Preserve existing rate limits
  and any stronger password rules.
- Site URL is `https://www.pheelm.com`; keep the existing `/auth/callback` redirect allowlist.
- Request a **new** code after saving; already-delivered emails cannot change.
- Test an existing member's password login and code login, signup confirmation, recovery,
  and reauthentication. Confirm that codes create a session only after successful verification
  and that invalid/expired codes show an error. Never record real codes or sessions in logs.

The connected Supabase MCP database tools do not expose Auth-template configuration.
Management access or a dashboard save is required to activate these templates. A website
deployment by itself does not fix the live email content.
