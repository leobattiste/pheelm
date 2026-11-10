/** Seeded rank with avalanche mixing: one stable permutation per browsing visit. */
export function filmShuffleRank(id: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}
