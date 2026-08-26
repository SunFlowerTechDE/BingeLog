/**
 * Deterministic hashing for the procedural card.
 *
 * The same wikidata_id must always produce the same card (M2 2.1). No
 * randomness at runtime, no timestamp in the seed — a card that changes
 * between renders is a card that cannot be cached, and one that looks
 * different on three devices (ADR-012).
 */

/** FNV-1a, 32 bit. Small, stable, and not a security primitive. */
export function hash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, kept in 32 bit without overflowing the mantissa.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * A small deterministic generator seeded from the hash, for the parts of
 * the card that vary without being meaningful (pattern placement).
 * Mulberry32: short, well distributed, and reproducible everywhere.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks one element of a list by hash. Stable for a given seed. */
export function pick<T>(items: readonly T[], seed: number): T {
  const item = items[seed % items.length];
  if (item === undefined) throw new Error('pick called with an empty list');
  return item;
}
