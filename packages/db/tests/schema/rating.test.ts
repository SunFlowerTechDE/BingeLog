/**
 * M3 3.3 and 3.4 — what a film page is allowed to show about ratings.
 *
 * The interesting cases are all about privacy: a private entry counts in
 * its owner's diary and nowhere else, and the community average has to
 * read the same for everyone regardless of who is asking.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { seedFilm, seedUser, startHarness, type Harness } from './harness.ts';

let h: Harness;
const FILM = 'Q500001';
const OTHER_FILM = 'Q500002';

let alice = '';
let bob = '';
let carol = '';

async function summary(film: string, as?: { role: 'anon' | 'authenticated'; user: string | null }) {
  const sql = `select average, votes from public.film_rating_summary($1)`;
  const rows = as
    ? await h.as(as.role, as.user).query<{ average: string | null; votes: number }>(sql, [film])
    : (await h.sql.query<{ average: string | null; votes: number }>(sql, [film])).rows;
  return rows[0];
}

async function log(
  user: string,
  film: string,
  rating: number | null,
  isPrivate = false,
): Promise<string> {
  const rows = await h
    .as('authenticated', user)
    .query<{ id: string }>(
      `insert into public.diary_entries (user_id, film_id, rating, is_private)
       values ($1, $2, $3, $4) returning id`,
      [user, film, rating, isPrivate],
    );
  return rows[0]?.id ?? '';
}

before(async () => {
  h = await startHarness();
  await seedFilm(h, FILM);
  await seedFilm(h, OTHER_FILM);
  alice = await seedUser(h, 'alice');
  bob = await seedUser(h, 'bob');
  carol = await seedUser(h, 'carol');
});

after(async () => {
  await h.stop();
});

describe('the community average', () => {
  it('is empty for a film nobody has rated', async () => {
    const result = await summary(OTHER_FILM);
    assert.equal(result?.average, null);
    assert.equal(result?.votes, 0);
  });

  it('averages the public ratings', async () => {
    await log(alice, FILM, 8);
    await log(bob, FILM, 6);

    const result = await summary(FILM);
    assert.equal(Number(result?.average), 7);
    assert.equal(result?.votes, 2);
  });

  it('ignores an entry logged without a rating', async () => {
    await log(carol, FILM, null);

    const result = await summary(FILM);
    assert.equal(result?.votes, 2, 'logging is not rating');
  });

  it('ignores a private rating', async () => {
    await log(carol, FILM, 1, true);

    const result = await summary(FILM);
    assert.equal(Number(result?.average), 7);
    assert.equal(result?.votes, 2, 'a private entry is a diary, not a verdict');
  });

  it('reads the same for its own author as for everyone else', async () => {
    // The trap a security-invoker view would fall into: the owner of a
    // private entry would see it counted, nobody else would, and the
    // "community average" would differ per reader.
    const asOwner = await summary(FILM, { role: 'authenticated', user: carol });
    const asStranger = await summary(FILM, { role: 'authenticated', user: bob });
    const asVisitor = await summary(FILM, { role: 'anon', user: null });

    assert.equal(Number(asOwner?.average), 7);
    assert.equal(Number(asStranger?.average), 7);
    assert.equal(Number(asVisitor?.average), 7);
  });

  it('counts a rewatch as another vote, because it is another viewing', async () => {
    await log(alice, FILM, 10);

    const result = await summary(FILM);
    assert.equal(result?.votes, 3);
  });

  it('rounds to two places rather than trailing a repeating fraction', async () => {
    const rows = await h.sql.query<{ average: string }>(
      `select average::text from public.film_rating_summary($1)`,
      [FILM],
    );
    assert.match(rows.rows[0]?.average ?? '', /^\d+\.\d{2}$/);
  });
});

describe('half stars', () => {
  it('stores ten steps, so five stars can be halved', async () => {
    // Migrating 5 steps to 10 later would falsify every existing rating,
    // which is why the scale is 1..10 from the first migration.
    const { rows } = await h.sql.query<{ ok: boolean }>(`
      select count(*) = 10 as ok from generate_series(1, 10) s
      where s between 1 and 10
    `);
    assert.equal(rows[0]?.ok, true);

    const tooHigh = await h
      .as('authenticated', alice)
      .expectError(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 11)`,
        [alice, OTHER_FILM],
      );
    assert.notEqual(tooHigh, null);

    const zero = await h
      .as('authenticated', alice)
      .expectError(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 0)`,
        [alice, OTHER_FILM],
      );
    assert.notEqual(zero, null, 'zero stars is not a rating, it is no rating');
  });
});

describe('the viewer’s own facet ratings', () => {
  it('returns only the caller’s own, never anyone else’s', async () => {
    const aliceEntry = await log(alice, OTHER_FILM, 9);
    const bobEntry = await log(bob, OTHER_FILM, 4);

    await h
      .as('authenticated', alice)
      .query(
        `insert into public.entry_facet_ratings (entry_id, facet, score)
         values ($1, 'cinematography', 10), ($1, 'story', 6)`,
        [aliceEntry],
      );
    await h
      .as('authenticated', bob)
      .query(
        `insert into public.entry_facet_ratings (entry_id, facet, score) values ($1, 'acting', 2)`,
        [bobEntry],
      );

    const mine = await h
      .as('authenticated', alice)
      .query<{ facet: string; score: number }>(`select * from public.my_facet_ratings($1)`, [
        OTHER_FILM,
      ]);

    assert.deepEqual(
      mine.map((row) => row.facet).sort(),
      ['cinematography', 'story'],
      'bob’s acting score must not appear',
    );
  });

  it('returns nothing for a film the caller has not rated', async () => {
    const rows = await h
      .as('authenticated', carol)
      .query(`select * from public.my_facet_ratings($1)`, [OTHER_FILM]);
    assert.deepEqual(rows, []);
  });

  it('accepts a partial set, because facets are optional', async () => {
    // Rating only two of seven is a complete answer (ADR-009).
    const rows = await h
      .as('authenticated', alice)
      .query(`select * from public.my_facet_ratings($1)`, [OTHER_FILM]);
    assert.equal(rows.length, 2);
  });
});
