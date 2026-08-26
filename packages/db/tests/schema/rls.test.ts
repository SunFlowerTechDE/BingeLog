/**
 * M0 Definition of Done, verified against a real Postgres.
 *
 * Every assertion here is made at the database level: SET ROLE plus a JWT
 * claim, exactly the way PostgREST talks to Postgres. If a row comes back
 * here, it comes back over the API too.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { seedFilm, seedUser, startHarness, type Harness } from './harness.ts';

let h: Harness;

const FILM = 'Q100001';
const QUIET_FILM = 'Q100002';

let rater = '';
let stranger = '';
let unrated = '';
const fillers: string[] = [];

before(async () => {
  h = await startHarness();

  await seedFilm(h, FILM);
  await seedFilm(h, QUIET_FILM);

  rater = await seedUser(h, 'rater');
  stranger = await seedUser(h, 'stranger');
  unrated = await seedUser(h, 'unrated');
  for (const name of ['fill1', 'fill2', 'fill3']) {
    fillers.push(await seedUser(h, name));
  }
});

after(async () => {
  await h.stop();
});

// ---------------------------------------------------------------------------

describe('migrations', () => {
  it('leaves every table in public with RLS enabled', async () => {
    const rows = await h.sql.query<{ relname: string }>(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    assert.deepEqual(rows.rows.map((r) => r.relname), []);
  });

  it('creates the seven facets of ADR-009 in order', async () => {
    const { rows } = await h.sql.query<{ enumlabel: string }>(`
      select e.enumlabel
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'facet_kind'
      order by e.enumsortorder
    `);
    assert.deepEqual(
      rows.map((r) => r.enumlabel),
      ['acting', 'story', 'directing', 'cinematography', 'sound', 'production_design', 'pacing'],
    );
  });

  it('creates the trigram index on the film titles', async () => {
    const { rows } = await h.sql.query(
      `select 1 from pg_indexes where schemaname = 'public' and indexname = 'films_title_trgm'`,
    );
    assert.equal(rows.length, 1);
  });

  it('creates the facet aggregate as a materialized view that refreshes', async () => {
    const { rows } = await h.sql.query(
      `select 1 from pg_matviews where matviewname = 'film_facet_averages'`,
    );
    assert.equal(rows.length, 1);
    await h.sql.query(`select public.refresh_film_facet_averages()`);
  });

  it('gives the catalog tables SELECT policies and nothing else', async () => {
    const { rows } = await h.sql.query<{ tablename: string; cmd: string }>(`
      select tablename, cmd from pg_policies
      where schemaname = 'public'
        and tablename in ('films', 'people', 'film_credits', 'genres', 'film_genres')
        and cmd <> 'SELECT'
    `);
    assert.deepEqual(rows, []);
  });
});

// ---------------------------------------------------------------------------

describe('catalog is read-only outside the pipeline', () => {
  it('lets anon read films', async () => {
    const rows = await h.as('anon', null).query(`select wikidata_id from public.films`);
    assert.equal(rows.length, 2);
  });

  it('rejects an insert into films from anon', async () => {
    const error = await h
      .as('anon', null)
      .expectError(`insert into public.films (wikidata_id, title_original) values ('Q9', 'X')`);
    assert.match(String(error), /row-level security/i);
  });

  it('rejects an insert into films from an authenticated user', async () => {
    const error = await h
      .as('authenticated', rater)
      .expectError(`insert into public.films (wikidata_id, title_original) values ('Q9', 'X')`);
    assert.match(String(error), /row-level security/i);
  });

  it('silently matches nothing when an authenticated user updates a film', async () => {
    await h
      .as('authenticated', rater)
      .query(`update public.films set title_de = 'Gekapert' where wikidata_id = $1`, [FILM]);

    const { rows } = await h.sql.query<{ title_de: string }>(
      `select title_de from public.films where wikidata_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.title_de, 'Vorrichtung');
  });

  it('lets the service role write the catalog', async () => {
    await h
      .as('service_role', null)
      .query(`insert into public.films (wikidata_id, title_original) values ('Q900', 'Pipeline')`);
    await h.sql.query(`delete from public.films where wikidata_id = 'Q900'`);
  });
});

// ---------------------------------------------------------------------------

describe('thread activation', () => {
  it('creates no thread below five distinct viewers', async () => {
    await h
      .as('authenticated', rater)
      .query(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8)`,
        [rater, FILM],
      );

    const { rows } = await h.sql.query<{ viewer_count: number; is_active: boolean }>(
      `select viewer_count, is_active from public.film_threads where film_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.viewer_count, 1);
    assert.equal(rows[0]?.is_active, false);
  });

  it('counts a rewatch as one viewer, not two', async () => {
    await h
      .as('authenticated', rater)
      .query(
        `insert into public.diary_entries (user_id, film_id, rating, is_rewatch)
         values ($1, $2, 9, true)`,
        [rater, FILM],
      );

    const { rows } = await h.sql.query<{ viewer_count: number }>(
      `select viewer_count from public.film_threads where film_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.viewer_count, 1);
  });

  it('does not double-count on an unrelated update of an entry', async () => {
    await h
      .as('authenticated', rater)
      .query(`update public.diary_entries set review = 'Nachtrag.' where user_id = $1`, [rater]);

    const { rows } = await h.sql.query<{ viewer_count: number }>(
      `select viewer_count from public.film_threads where film_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.viewer_count, 1);
  });

  it('activates the thread at the fifth distinct viewer', async () => {
    await h
      .as('authenticated', unrated)
      .query(`insert into public.diary_entries (user_id, film_id) values ($1, $2)`, [
        unrated,
        FILM,
      ]);

    for (const [index, filler] of fillers.entries()) {
      await h
        .as('authenticated', filler)
        .query(`insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 6)`, [
          filler,
          FILM,
        ]);

      const { rows } = await h.sql.query<{ viewer_count: number; is_active: boolean }>(
        `select viewer_count, is_active from public.film_threads where film_id = $1`,
        [FILM],
      );
      const expected = index + 3;
      assert.equal(rows[0]?.viewer_count, expected);
      assert.equal(rows[0]?.is_active, expected >= 5);
    }
  });

  it('keeps the thread active after a viewer deletes their entry', async () => {
    const filler = fillers[0];
    assert.ok(filler, 'filler users must be seeded');
    await h
      .as('authenticated', filler)
      .query(`delete from public.diary_entries where user_id = $1 and film_id = $2`, [
        filler,
        FILM,
      ]);

    const { rows } = await h.sql.query<{ viewer_count: number; is_active: boolean }>(
      `select viewer_count, is_active from public.film_threads where film_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.viewer_count, 4);
    assert.equal(rows[0]?.is_active, true, 'activation must latch, ADR-010');

    await h
      .as('authenticated', filler)
      .query(`insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 6)`, [
        filler,
        FILM,
      ]);
  });
});

// ---------------------------------------------------------------------------

describe('the spoiler gate', () => {
  let messageId = '';

  it('lets a rated user post', async () => {
    const rows = await h
      .as('authenticated', rater)
      .query<{ id: string }>(
        `insert into public.thread_messages (user_id, film_id, body)
         values ($1, $2, 'Das Ende erklaert alles davor.') returning id`,
        [rater, FILM],
      );
    messageId = rows[0]?.id ?? '';
    assert.notEqual(messageId, '');
  });

  it('returns zero rows to anon', async () => {
    const rows = await h.as('anon', null).query(`select id from public.thread_messages`);
    assert.deepEqual(rows, []);
  });

  it('returns zero rows to a user with no entry for the film', async () => {
    const rows = await h
      .as('authenticated', stranger)
      .query(`select id from public.thread_messages where film_id = $1`, [FILM]);
    assert.deepEqual(rows, []);
  });

  it('returns zero rows to a user whose entry carries no rating', async () => {
    const rows = await h
      .as('authenticated', unrated)
      .query(`select id from public.thread_messages where film_id = $1`, [FILM]);
    assert.deepEqual(rows, [], 'logging alone must not open the discussion');
  });

  it('does not leak the body through a targeted fetch by id', async () => {
    const rows = await h
      .as('authenticated', stranger)
      .query(`select body from public.thread_messages where id = $1`, [messageId]);
    assert.deepEqual(rows, []);
  });

  it('does not leak the body through a join from films', async () => {
    const rows = await h
      .as('authenticated', stranger)
      .query(
        `select m.body from public.films f
         join public.thread_messages m on m.film_id = f.wikidata_id
         where f.wikidata_id = $1`,
        [FILM],
      );
    assert.deepEqual(rows, []);
  });

  it('does not leak the count through an aggregate', async () => {
    const rows = await h
      .as('authenticated', stranger)
      .query<{ count: string }>(`select count(*) from public.thread_messages`);
    assert.equal(rows[0]?.count, '0');
  });

  it('shows the message to the rated user', async () => {
    const rows = await h
      .as('authenticated', rater)
      .query(`select id from public.thread_messages where film_id = $1`, [FILM]);
    assert.equal(rows.length, 1);
  });

  it('opens the gate as soon as a rating is added to an existing entry', async () => {
    await h
      .as('authenticated', unrated)
      .query(`update public.diary_entries set rating = 5 where user_id = $1 and film_id = $2`, [
        unrated,
        FILM,
      ]);

    const rows = await h
      .as('authenticated', unrated)
      .query(`select id from public.thread_messages where film_id = $1`, [FILM]);
    assert.equal(rows.length, 1);
  });

  it('opens the gate for a private entry too', async () => {
    await h
      .as('authenticated', unrated)
      .query(`update public.diary_entries set is_private = true where user_id = $1`, [unrated]);

    const rows = await h
      .as('authenticated', unrated)
      .query(`select id from public.thread_messages where film_id = $1`, [FILM]);
    assert.equal(rows.length, 1, 'privacy of the entry is not the gate');
  });

  it('rejects a post from a user with no entry', async () => {
    const error = await h
      .as('authenticated', stranger)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, 'Hallo')`,
        [stranger, FILM],
      );
    assert.match(String(error), /row-level security/i);
  });

  it('rejects a post attributed to someone else', async () => {
    const error = await h
      .as('authenticated', rater)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, 'Fremd')`,
        [stranger, FILM],
      );
    assert.match(String(error), /row-level security/i);
  });

  it('rejects a post to a thread that is not active', async () => {
    await h
      .as('authenticated', rater)
      .query(`insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 7)`, [
        rater,
        QUIET_FILM,
      ]);

    const error = await h
      .as('authenticated', rater)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, 'Erster')`,
        [rater, QUIET_FILM],
      );
    assert.match(String(error), /row-level security/i);
  });

  it('rejects a reply pointing at a message about another film', async () => {
    const error = await h
      .as('authenticated', rater)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, parent_id, body)
         values ($1, $2, $3, 'Falscher Film')`,
        [rater, QUIET_FILM, messageId],
      );
    assert.notEqual(error, null);
  });

  it('rejects writing into a locked thread', async () => {
    await h.sql.query(`update public.film_threads set is_locked = true where film_id = $1`, [
      FILM,
    ]);

    const error = await h
      .as('authenticated', rater)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, 'Trotzdem')`,
        [rater, FILM],
      );
    assert.match(String(error), /row-level security/i);

    await h.sql.query(`update public.film_threads set is_locked = false where film_id = $1`, [
      FILM,
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('message integrity', () => {
  it('cannot be reassigned to another user', async () => {
    const { rows: before } = await h.sql.query<{ id: string }>(
      `select id from public.thread_messages limit 1`,
    );
    const id = before[0]?.id ?? '';

    await h
      .as('authenticated', rater)
      .query(`update public.thread_messages set user_id = $1 where id = $2`, [stranger, id]);

    const { rows } = await h.sql.query<{ user_id: string }>(
      `select user_id from public.thread_messages where id = $1`,
      [id],
    );
    assert.equal(rows[0]?.user_id, rater);
  });

  it('stamps edited_at server-side when the body changes', async () => {
    const { rows: before } = await h.sql.query<{ id: string }>(
      `select id from public.thread_messages limit 1`,
    );
    const id = before[0]?.id ?? '';

    await h
      .as('authenticated', rater)
      .query(`update public.thread_messages set body = 'Korrigiert.' where id = $1`, [id]);

    const { rows } = await h.sql.query<{ edited_at: Date | null }>(
      `select edited_at from public.thread_messages where id = $1`,
      [id],
    );
    assert.notEqual(rows[0]?.edited_at, null);
  });

  it('stops the eleventh message within an hour', async () => {
    const limited = await seedUser(h, 'limited');
    await h
      .as('authenticated', limited)
      .query(`insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 7)`, [
        limited,
        FILM,
      ]);

    for (let i = 0; i < 10; i++) {
      const error = await h
        .as('authenticated', limited)
        .expectError(
          `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, $3)`,
          [limited, FILM, `Beitrag ${String(i)}`],
        );
      assert.equal(error, null, `message ${String(i)} must be accepted`);
    }

    const error = await h
      .as('authenticated', limited)
      .expectError(
        `insert into public.thread_messages (user_id, film_id, body) values ($1, $2, 'Zu viel')`,
        [limited, FILM],
      );
    assert.match(String(error), /rate_limit_exceeded/);
  });
});

// ---------------------------------------------------------------------------

describe('diary and facet visibility', () => {
  it('hides a private entry from everyone but its owner', async () => {
    const rows = await h
      .as('authenticated', rater)
      .query<{ id: string }>(
        `insert into public.diary_entries (user_id, film_id, rating, is_private)
         values ($1, $2, 3, true) returning id`,
        [rater, FILM],
      );
    const id = rows[0]?.id ?? '';

    const anonRows = await h
      .as('anon', null)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    const otherRows = await h
      .as('authenticated', stranger)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    const ownRows = await h
      .as('authenticated', rater)
      .query(`select id from public.diary_entries where id = $1`, [id]);

    assert.deepEqual(anonRows, []);
    assert.deepEqual(otherRows, []);
    assert.equal(ownRows.length, 1);
  });

  it('keeps the watchlist private', async () => {
    await h
      .as('authenticated', rater)
      .query(`insert into public.watchlist (user_id, film_id) values ($1, $2)`, [
        rater,
        QUIET_FILM,
      ]);

    const otherRows = await h
      .as('authenticated', stranger)
      .query(`select film_id from public.watchlist`);
    const ownRows = await h.as('authenticated', rater).query(`select film_id from public.watchlist`);

    assert.deepEqual(otherRows, []);
    assert.equal(ownRows.length, 1);
  });

  it('makes facets follow the visibility of their entry', async () => {
    const pub = await h
      .as('authenticated', rater)
      .query<{ id: string }>(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8) returning id`,
        [rater, FILM],
      );
    const priv = await h
      .as('authenticated', rater)
      .query<{ id: string }>(
        `insert into public.diary_entries (user_id, film_id, rating, is_private)
         values ($1, $2, 8, true) returning id`,
        [rater, FILM],
      );

    await h
      .as('authenticated', rater)
      .query(
        `insert into public.entry_facet_ratings (entry_id, facet, score)
         values ($1, 'cinematography', 9), ($2, 'story', 2)`,
        [pub[0]?.id, priv[0]?.id],
      );

    const visible = await h
      .as('anon', null)
      .query(`select facet from public.entry_facet_ratings where entry_id = $1`, [pub[0]?.id]);
    const hidden = await h
      .as('anon', null)
      .query(`select facet from public.entry_facet_ratings where entry_id = $1`, [priv[0]?.id]);

    assert.equal(visible.length, 1);
    assert.deepEqual(hidden, []);
  });

  it('rejects a facet on someone else’s entry', async () => {
    const { rows } = await h.sql.query<{ id: string }>(
      `select id from public.diary_entries where user_id = $1 limit 1`,
      [rater],
    );

    const error = await h
      .as('authenticated', stranger)
      .expectError(
        `insert into public.entry_facet_ratings (entry_id, facet, score) values ($1, 'acting', 10)`,
        [rows[0]?.id],
      );
    assert.match(String(error), /row-level security/i);
  });

  it('suppresses a facet average below five votes', async () => {
    await h.sql.query(`select public.refresh_film_facet_averages()`);
    const { rows } = await h.sql.query<{ vote_count: string }>(
      `select vote_count from public.film_facet_averages`,
    );
    assert.deepEqual(rows, [], 'one vote must not surface, ADR-009');
  });

  it('publishes a facet average once five public votes exist', async () => {
    for (const [index, voter] of [rater, stranger, unrated, ...fillers].entries()) {
      await h.sql.query(
        `insert into public.diary_entries (id, user_id, film_id, rating)
         values (gen_random_uuid(), $1, $2, 7)`,
        [voter, QUIET_FILM],
      );
      const { rows } = await h.sql.query<{ id: string }>(
        `select id from public.diary_entries
         where user_id = $1 and film_id = $2 order by created_at desc limit 1`,
        [voter, QUIET_FILM],
      );
      await h.sql.query(
        `insert into public.entry_facet_ratings (entry_id, facet, score) values ($1, 'pacing', $2)`,
        [rows[0]?.id, 5 + (index % 3)],
      );
    }

    await h.sql.query(`select public.refresh_film_facet_averages()`);
    const { rows } = await h.sql.query<{ film_id: string; vote_count: string }>(
      `select film_id, vote_count from public.film_facet_averages`,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.film_id, QUIET_FILM);
    assert.equal(Number(rows[0]?.vote_count), 6);
  });
});
