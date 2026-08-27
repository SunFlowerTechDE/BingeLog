/**
 * What a click on a popcorn bucket does.
 *
 * Kept out of the component so it can be tested on its own: the cycle is
 * three-valued and easy to get subtly wrong, and a rating that behaves
 * differently from what the hover promised is worse than no hover.
 */

/** Half-star steps, 1..10 in the database, 0 meaning no rating. */
export const RATING_MAX = 10;

/**
 * Clicking bucket `bucket` (1..5) against the current rating.
 *
 * A click places whole buckets. Clicking the bucket you already stand on
 * refines it — full to half, half to gone — so the ordinary gesture is
 * one tap onto a round number and half steps are a second thought.
 */
export function nextRating(current: number, bucket: number): number {
  const whole = bucket * 2;
  if (current === whole) return whole - 1;
  if (current === whole - 1) return whole - 2;
  return whole;
}
