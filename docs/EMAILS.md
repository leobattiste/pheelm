# Pheelm email system

## Live architecture

- Supabase database triggers enqueue future events in the private `pheelm_email.outbox` schema.
- Scheduling is defined in `supabase/email-schedule.sql`. Supabase Cron invokes `pheelm-email` every five minutes. The worker authenticates with a dedicated token stored in Vault.
- The Edge Function uses its platform-provided service-role credential. The domain-restricted Resend key and webhook signing secret are stored in Vault, never in Git or browser bundles.
- Messages use `Pheelm <notifications@pheelm.com>` and reply to `hey@pheelm.com`.
- Resend delivery/bounce/complaint webhooks require Svix signature verification and a five-minute timestamp window. Event IDs are deduplicated. Bounced and complained recipients are suppressed.
- Queue jobs use deterministic Resend idempotency keys, row-lock claims, leases, bounded retries and a twelve-hour expiry. Email content is retained for fourteen days.
- The deployed worker sends the rendered HTML/plain-text layouts in `supabase/functions/pheelm-email/templates.compact.json`: two shared layouts (with and without the unsubscribe footer) plus each email's words. `unpack.mjs` fills the words in; the worker fills `[[MESSAGE]]`, `[[ACTION_URL]]`, `[[UNSUBSCRIBE_URL]]`, `[[POSTAL_ADDRESS]]` and `[[YEAR]]` when it sends. The design is `emails/PheelmEmail.tsx`; the words (title, subject, button, preheader, three good-to-know rows, a closing note) are in `emails/catalog.json`. After changing either, run `npm run email:preview` and deploy `index.ts`, `security.ts`, `unpack.mjs`, `templates.compact.json` and `deno.json`. The wordmark in the header is `public/brand/pheelm-wordmark-email.png`, served from pheelm.com.
- Production copies are published in Resend under `pheelm-live-*`. Editable original designs are preserved under `pheelm-*` as drafts. Dashboard edits do not automatically update the deployed snapshots: regenerate and deploy the worker after changing the source.

## Templates and event coverage

| Template | Trigger |
| --- | --- |
| reset-password | Supabase Auth password reset; same SMTP configuration and template paste as the others |
| confirm-signup | Supabase Auth confirmation; SMTP configuration below is required |
| sign-in | Supabase Auth magic link + one-time code; SMTP configuration below is required |
| confirm-email-change | Supabase Auth secure email change; SMTP configuration below is required |
| welcome | New account becomes email-confirmed; no historical backfill |
| security-notice | Confirmed account email changes; sent to old and new addresses |
| account-deleted | Account deletion completes |
| submission-received | Film submission inserted |
| submission-update | Submission review status changes; does not claim an approved draft is published |
| contact-received | Contact, feedback, press, privacy or partnership message inserted; rate-limited |
| support-response | Admin chooses Reply through Pheelm in the inbox |
| collection-invitation | Invitation notification created and email preference allows it |
| collaboration-update | Collaboration request or membership response notification created and email preference allows it |
| newsletter-confirmation | New newsletter subscription request; double opt-in, no automatic mailing-list import |
| activity-update | A reply, mention, comment on your watchlist or new film from a followed director, unless “Replies, mentions and new films” is off; at most 5 an hour; says what happened, never who or what was said |
| activity-digest | Digest: newly added public films, directors and collections; daily or weekly from the member’s selection; off by default; empty periods send no email |
| newsletter | Ready for a separately authorized editorial campaign; no campaign is sent by this setup |
| report-update | Template ready; report outcome messages require an explicit moderation action |
| moderation-notice | Template ready; requires an explicit moderation action |
| service-notice | Template ready; requires a specific service notice |
| data-export-ready | Template ready for a future asynchronous export; current export is synchronous |
| admin-digest | Template ready for a future dedicated admin summary; normal activity digest can include admin notifications |

Essential account and request emails are separate from optional email preferences. In-app disabled notification types are respected for collaboration. Digest has its own Off/Daily/Weekly preference and covers public catalog additions, not unread community activity. Public newsletter requests do not confer marketing consent until confirmed. Owner CSV export includes only confirmed, currently subscribed, unsuppressed recipients; historical addresses are not silently opted in.

## Supabase Auth SMTP: remaining dashboard connection

The connected Supabase tools can deploy functions and migrations, but do not expose Auth configuration. Existing Supabase login delivery is left intact until these settings are applied.

In https://supabase.com/dashboard/project/mvhwfmlairwrngdttzjh/auth/smtp configure:

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: the domain-restricted sending key stored separately by the setup agent (not this repository)
- Sender: `notifications@pheelm.com`
- Sender name: `Pheelm`

Paste the generated files into the matching Supabase Auth email templates:

- Confirm signup: `supabase/email/confirm-signup.html`
- Magic link: `supabase/email/magic-link.html`
- Change email: `supabase/email/confirm-email-change.html`
- Reset password: `supabase/email/reset-password.html`

These carry the copyright year of the day `npm run email:preview` was run, so run it and paste them again each January.

Keep secure email change, email confirmation, current OTP expiry and redirect allowlists enabled. These templates preserve `next` through `RedirectTo`, which must contain the callback query string as the current sign-in form supplies it. Never enable click tracking on authentication mail.

Alternatively, use `NODE_USE_ENV_PROXY=1 node scripts/auth-email-config.mjs` in a protected local environment with `SUPABASE_ACCESS_TOKEN` and `RESEND_API_KEY`. The script never prints credentials or commits them. It changes only SMTP, email subjects and the three template bodies, and does not loosen auth security settings.

## Development and verification

- `npm run email:preview`: generates the HTML and plain-text previews, the worker's templates and the four Supabase Auth templates.
- `node tests/email-security.mjs`: verifies escaping, trusted destinations, signature authentication, replay window, that every email's footer says only “© year Pheelm”, and all rendered templates.
- PostgreSQL tests: apply `tests/email-bootstrap.sql` to a disposable PostgreSQL database, then `supabase/email-system.sql`, then `tests/email-system.sql`. Never apply the bootstrap to production.
- `npm run build`: verifies the website and email preference/admin components.

GET links never change subscription state. Public confirmation and unsubscribe forms are served from `/email` on Pheelm, and POST actions require the opaque token. RFC 8058 one-click unsubscribe is supported using signed opaque tokens for optional digests. One-click authentication links and OTP codes are handled only by Supabase Auth.

No bulk campaigns or historical user emails are sent during setup. Delivery tests use only Resend's documented `delivered+...@resend.dev` test sink.

## Operations

Inspect queue state and retry errors in the private schema using the SQL editor. Never expose `email_delivery_config()` to anon/authenticated roles. Failed jobs require investigation; do not blindly replay jobs older than the provider's idempotency window. Keep the sending key and webhook secret in Vault; rotation must update Vault before switching providers.

## Catalog Digest

`supabase/catalog-digest.sql` records newly discoverable items on the five-minute delivery schedule. Existing catalog entries are baselined without announcements. Daily and weekly subscriptions accumulate additions from their preference selection time. Eligibility is checked again immediately before sending, excluding drafts, hidden directors, private collections/profiles, and collections below the public discovery threshold. Changing frequency resets the accumulation window; Off stops future digests.

## Wording

Emails say “watchlist”, like the site. `supabase/email-wording.sql` updates the queued messages in the three database functions that still said “collection” (welcome, collaboration, digest heading); the same words are fixed in `email-system.sql`, `activity-emails.sql` and `catalog-digest.sql`.
