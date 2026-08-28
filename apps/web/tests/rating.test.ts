/**
 * M3 3.4 — what a click on a popcorn bucket does.
 *
 * Whole buckets are the ordinary gesture; halves are a second thought.
 * The cycle is three-valued, so it is checked rather than assumed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { nextRating } from '../src/lib/rating.ts';

describe('placing whole popcorn', () => {
  it('places whole buckets from nothing', () => {
    assert.equal(nextRating(0, 1), 2);
    assert.equal(nextRating(0, 3), 6);
    assert.equal(nextRating(0, 5), 10);
  });

  it('jumps straight to whole when clicking a different bucket', () => {
    // Standing at 2,5 and clicking the fourth bucket gives 4,0, not 3,5.
    assert.equal(nextRating(5, 4), 8);
    assert.equal(nextRating(9, 2), 4);
  });

  it('never lands on a half by accident', () => {
    for (let current = 0; current <= 10; current++) {
      for (let bucket = 1; bucket <= 5; bucket++) {
        const result = nextRating(current, bucket);
        const isRefinement = current === bucket * 2 || current === bucket * 2 - 1;
        if (!isRefinement) {
          assert.equal(
            result % 2,
            0,
            `clicking ${String(bucket)} at ${String(current)} gave a half`,
          );
        }
      }
    }
  });
});

describe('refining the bucket you stand on', () => {
  it('halves a full one', () => {
    assert.equal(nextRating(6, 3), 5);
    assert.equal(nextRating(10, 5), 9);
  });

  it('removes a half one', () => {
    assert.equal(nextRating(5, 3), 4);
    assert.equal(nextRating(9, 5), 8);
  });

  it('comes back round to full', () => {
    let rating = 6;
    rating = nextRating(rating, 3);
    assert.equal(rating, 5);
    rating = nextRating(rating, 3);
    assert.equal(rating, 4);
    rating = nextRating(rating, 3);
    assert.equal(rating, 6, 'the cycle closes rather than sticking');
  });

  it('takes the rating back entirely on the first bucket', () => {
    // The only way to unrate by clicking, and it has to be reachable.
    assert.equal(nextRating(2, 1), 1);
    assert.equal(nextRating(1, 1), 0);
  });

  it('never goes below nothing', () => {
    for (let current = 0; current <= 10; current++) {
      for (let bucket = 1; bucket <= 5; bucket++) {
        const result = nextRating(current, bucket);
        assert.ok(result >= 0, `${String(current)} / ${String(bucket)} gave ${String(result)}`);
        assert.ok(result <= 10);
      }
    }
  });
});
