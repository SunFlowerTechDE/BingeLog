import { hash32 } from './hash.ts';

/**
 * The cache-busting token for a poster URL.
 *
 * Derived from the film's `updated_at` as the database serialises it, and
 * from nothing else. An earlier version compared `Date.parse(updated_at)`
 * on both sides, which looked equivalent but is not: parsing a Date
 * object goes through its string form and silently drops milliseconds,
 * while parsing the JSON string keeps them. The two sides then disagreed
 * and every request quietly fell back to the short cache lifetime.
 *
 * Hashing the raw string removes the question. Both sides see the same
 * characters and compute the same token.
 */
export function posterVersion(updatedAt: string): string {
  return hash32(updatedAt).toString(36);
}
