import "server-only";

import { getServerClient } from "@/lib/supabase/server";

export type ModeratedField = "comment" | "bio" | "watchlist_description";
export type ModerationResult = { ok: true } | { ok: false; message: string };

/** What a member sees when their text has a word from the banned list. */
export const bannedWordMessage = (word: string) => `“${word}” can't be used on Pheelm. Remove it and try again.`;

/**
 * Called on the SERVER just before a member saves a comment, bio or watchlist description.
 * Checks the text against Pheelm's banned-word list (kept in the database, see
 * supabase/banned-words.sql) and names the word to remove. The database refuses the same words
 * when saving, so if this check can't run the save is still protected.
 */
export async function checkText(field: ModeratedField, rawText: string): Promise<ModerationResult> {
  const text = rawText.trim();
  if (!text) return { ok: true };
  const db = await getServerClient();
  if (!db) return { ok: true };
  const { data, error } = await db.rpc("check_text", { p_field: field, p_text: text });
  if (error) return { ok: true };
  return typeof data === "string" && data ? { ok: false, message: bannedWordMessage(data) } : { ok: true };
}

/** The database's refusal, as the member should read it, when a save is refused for a banned word. */
export function bannedWordError(error: { message?: string } | null | undefined): string | null {
  return error?.message?.includes("can't be used on Pheelm") ? error.message : null;
}
