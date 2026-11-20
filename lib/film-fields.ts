/**
 * Which poster a save should keep.
 *
 * The editor holds its own copy of the poster field, so a poster that arrived after the page
 * opened — from an import, or from a file uploaded on an earlier save — was not in that copy, and
 * saving wrote the empty box back over it. An empty box now means "unchanged"; erasing a poster
 * is a deliberate tick of Remove poster.
 */
export function resolvePoster({ uploaded, typed, previous, remove }: {
  uploaded?: string | null;
  typed?: string | null;
  previous?: string | null;
  remove?: boolean;
}): string | null {
  if (uploaded) return uploaded;
  if (remove) return null;
  return typed || previous || null;
}
