# Pheelm: OpenAI content moderation

Scope: new and edited collection comments, profile bios, and collection/watchlist descriptions. Existing content is not automatically rescanned. The public interface and styling are unchanged.

## Activation (do not skip the order)

1. Obtain an OpenAI API key for the [Moderation API](https://developers.openai.com/api/docs/guides/moderation). Do not paste or commit the key.
2. In Vercel > Pheelm > Environment Variables, set `OPENAI_API_KEY` as a server-only secret for production and desired previews. Verify `SUPABASE_SERVICE_ROLE_KEY` is configured server-side. Never use `NEXT_PUBLIC_` for either secret.
3. Merge/deploy the code in this PR, and confirm the site build succeeds.
4. Apply `supabase/content-moderation.sql` to Pheelm's Supabase project, after the new server code is deployed. Applying it early blocks all newly submitted comment/bio/description text without a receipt.
5. Test: publish a normal comment, edit it, update a bio, update a collection description, and confirm they save. Try a slur or explicit abusive comment, which should receive a clear message without saving. Try a direct authenticated Supabase REST write with a new non-empty comment: the database should reject it. Also verify unrelated watchlist changes and clearing a bio still work.
6. If a moderation call fails or a key is missing, the content is not published; the user sees a retry message. Check the server logs and environment.

## Behavior

- `lib/moderation.ts` makes the OpenAI API call from the Next.js server, never the browser.
- The model is `omni-moderation-latest`. Severe policy categories and common explicit profanity are rejected. General mentions of violence or difficult topics in film analysis are not automatically rejected.
- An approved text receives a short-lived, single-use receipt in a private database table, linked to the signed-in user and exact text. Database triggers consume the receipt and reject unmoderated browser writes. Clearing text is allowed.
- Rejections preserve form content so the member can edit it. Ordinary comments are shown only after successful moderation and saving.
- The existing database RLS, comment length limits, blocked-user rules, rate limits and reporting remain in force.
- Film titles, director names, admin editorial metadata, and older submissions are intentionally outside this initial scope.

## Operational notes

Moderation is classification, not perfect context understanding. Review reports and appeals manually, particularly for film history, quotation, and reclaimed language. The profanity regex is a supplement, not an exhaustive language or slur detector. Never log submitted text or API keys.

To disable moderation safely, revert the database triggers with a reviewed migration as well as the server actions; merely deleting `OPENAI_API_KEY` will cause new text to fail closed.

The API may process submitted text externally. Disclose moderation processing in Pheelm's privacy information before launch.
