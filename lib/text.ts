/** The first sentence of a passage, for one-line summaries. */
export function firstSentence(text: string) {
  const m = text.match(/^.+?[.!?](?=\s+[A-Z"“‘]|$)/);
  return (m ? m[0] : text).trim();
}
