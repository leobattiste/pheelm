/**
 * Messages for text with a word from Pheelm's banned-word list. The database writes them (see
 * supabase/banned-words.sql): what kind of word it is, and what to write instead when there's an
 * alternative, e.g. "Swearing isn't allowed on Pheelm. Try “b-word” instead." Shared by the server
 * and the browser, which shows them as a toast.
 */

/** The database's message, or (from an older database that only names the word gently) one built from that name. */
export const bannedWordMessage = (fromDatabase: string) =>
  isBannedWordMessage(fromDatabase) ? fromDatabase : `Pheelm doesn't allow ${fromDatabase}. Remove it and try again.`;

export const isBannedWordMessage = (message: string | null | undefined) =>
  !!message && (message.includes(" allowed on Pheelm.") || message.startsWith("Pheelm doesn't allow "));
