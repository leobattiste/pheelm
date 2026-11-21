# Pheelm: content moderation

Scope: new and edited collection comments, profile bios, and collection/watchlist descriptions.

Pheelm moderates with its own banned-word list, kept in the database. It replaced the earlier
OpenAI Moderation check (`supabase/archive/content-moderation.sql`), which is no longer used: no outside
service sees members' text, and no API key is needed for moderation.

## How it works

1. **Before saving**, the server calls `check_text` (`lib/moderation.ts`). If the text has a banned
   word, the member is told what kind of word it is, never the word itself, and for some words what
   to write instead ("Swearing isn't allowed on Pheelm. Try “b-word” instead."). Their text stays
   in the form so they can edit it.
2. **As a backstop**, the `refuse_banned_words` triggers on comments, profiles and lists refuse the
   same words, so a direct request to Supabase can't get around the check.
3. **Each refusal is logged** in `private.moderation_refusals` (who, which field, a short excerpt,
   the reason), kept for 90 days and capped at 30 per member per hour. Admins see it at
   **Admin → Community → Moderation**.

Matching rules, the word kinds and how to add a word by SQL are described at the top of
`supabase/archive/banned-words.sql`.

## Managing the list

Add, edit or remove words at **Admin → Community → Banned words**. Each word has a kind (swearing,
sexist, racist, antisemitic, homophobic, transphobic, ableist) and an optional suggestion to use
instead.

## Operational notes

A word list is a supplement, not a full understanding of context. Review reports at
**Admin → Community** manually, particularly for film history, quotation and reclaimed language.
Matching is whole-word, so place names like "Scunthorpe" pass; if a legitimate word is refused,
remove or narrow the entry.

The database's row-level security, comment length limits, blocked-member rules, rate limits and
reporting all stay in force alongside the word list.
