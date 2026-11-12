/**
 * The message a member sees when their text has a word from Pheelm's banned-word list. The
 * database names the word gently ("the b-word", "a racist slur"); see supabase/banned-words.sql.
 * Shared by the server (to write it) and the browser (to show it as a toast).
 */
export const bannedWordMessage = (label: string) => `Pheelm doesn't allow ${label}. Remove it and try again.`;
export const isBannedWordMessage = (message: string | null | undefined) => !!message?.startsWith("Pheelm doesn't allow ");
