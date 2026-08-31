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
    assert.deepEqual(
      rows.rows.map((r) => r.relname),
      [],
    );
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
      .query(`insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8)`, [
        rater,
        FILM,
      ]);

    const { rows } = await h.sql.query<{ viewer_count: number; is_active: boolean }>(
      `select viewer_count, is_active from public.film_threads where film_id = $1`,
      [FILM],
    );
    assert.equal(rows[0]?.viewer_count, 1);
    assert.equal(rows[0]?.is_active, false);
  });

  it('counts a rewatch as one viewer, not two', async () => {
    await h.as('authenticated', rater).query(
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
    const rows = await h.as('authenticated', rater).query<{ id: string }>(
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
    const rows = await h.as('authenticated', stranger).query(
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
      .query(`update public.diary_entries set visibility = 'private' where user_id = $1`, [
        unrated,
      ]);

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
    const error = await h.as('authenticated', rater).expectError(
      `insert into public.thread_messages (user_id, film_id, parent_id, body)
         values ($1, $2, $3, 'Falscher Film')`,
      [rater, QUIET_FILM, messageId],
    );
    assert.notEqual(error, null);
  });

  it('rejects writing into a locked thread', async () => {
    await h.sql.query(`update public.film_threads set is_locked = true where film_id = $1`, [FILM]);

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

describe('profile statistics', () => {
  it('counts only what the reader may see', async () => {
    const film = 'Q100005';
    const quiet = 'Q100006';
    await seedFilm(h, film);
    await seedFilm(h, quiet);

    // Eigenes Konto: die anderen tragen Eintraege aus frueheren Tests,
    // und eine Zahl laesst sich nur gegen einen bekannten Stand pruefen.
    const zaehler = await seedUser(h, 'zaehler');

    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, review, visibility)
       values ($1, $2, 8, 'Sichtbar', 'public'), ($1, $3, 10, null, 'private')`,
      [zaehler, film, quiet],
    );

    const eigene = await h
      .as('authenticated', zaehler)
      .query<{ films: number; ratings: number }>(`select * from public.profile_stats($1)`, [
        zaehler,
      ]);
    const fremde = await h
      .as('authenticated', stranger)
      .query<{ films: number; ratings: number }>(`select * from public.profile_stats($1)`, [
        zaehler,
      ]);

    assert.equal(eigene[0]?.films, 2, 'die eigene Sicht zeigt alles');
    assert.equal(fremde[0]?.films, 1, 'ein privater Eintrag darf nicht mitgezaehlt werden');

    // Nicht nur die Zahl: auch der Schnitt darf den privaten Wert nicht
    // verraten. 8 und 10 gemittelt waeren 9.
    const schnitt = Number(
      (
        await h
          .as('authenticated', stranger)
          .query<{ average: string }>(`select * from public.profile_stats($1)`, [zaehler])
      )[0]?.average,
    );
    assert.equal(schnitt, 8, 'der Schnitt darf den privaten Wert nicht durchscheinen lassen');

    await h.sql.query(`delete from public.diary_entries where film_id in ($1, $2)`, [film, quiet]);
  });

  it('names a genre only from two films on', async () => {
    const einzeln = await seedUser(h, 'einzelseher');
    const a = 'Q100007';
    const b = 'Q100008';
    await seedFilm(h, a);
    await seedFilm(h, b);

    await h.sql.query(
      `insert into public.genres (wikidata_id, label_de) values ('Q900001', 'Probegenre')
       on conflict do nothing`,
    );
    await h.sql.query(`insert into public.film_genres (film_id, genre_id) values ($1, 'Q900001')`, [
      a,
    ]);
    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8)`,
      [einzeln, a],
    );

    const beiEinem = await h
      .as('authenticated', einzeln)
      .query(`select * from public.profile_genres($1)`, [einzeln]);
    assert.deepEqual(beiEinem, [], 'ein Film macht kein Lieblingsgenre');

    // Zweiter Film desselben Genres: jetzt zaehlt es.
    await h.sql.query(`insert into public.film_genres (film_id, genre_id) values ($1, 'Q900001')`, [
      b,
    ]);
    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 9)`,
      [einzeln, b],
    );

    const beiZweien = await h
      .as('authenticated', einzeln)
      .query<{ label: string; films: number }>(`select * from public.profile_genres($1)`, [
        einzeln,
      ]);
    assert.deepEqual(
      beiZweien.map((g) => g.label),
      ['Probegenre'],
    );

    await h.sql.query(`delete from public.diary_entries where user_id = $1`, [einzeln]);
  });
});

// ---------------------------------------------------------------------------

describe('friends-only entries', () => {
  it('stays hidden while only one side follows', async () => {
    const rows = await h.as('authenticated', rater).query<{ id: string }>(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
         values ($1, $2, 7, 'friends') returning id`,
      [rater, QUIET_FILM],
    );
    const id = rows[0]?.id ?? '';

    // Der Fremde folgt. Das allein macht ihn nicht zum Freund — sonst
    // waere die Stufe keine Sperre, sondern eine Einladung.
    await h
      .as('authenticated', stranger)
      .query(`insert into public.follows (follower_id, followee_id) values ($1, $2)`, [
        stranger,
        rater,
      ]);

    const oneWay = await h
      .as('authenticated', stranger)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    assert.deepEqual(oneWay, [], 'einseitiges Folgen darf nicht reichen');

    // Erst die Gegenrichtung oeffnet.
    await h
      .as('authenticated', rater)
      .query(`insert into public.follows (follower_id, followee_id) values ($1, $2)`, [
        rater,
        stranger,
      ]);

    const mutual = await h
      .as('authenticated', stranger)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    assert.equal(mutual.length, 1, 'beidseitiges Folgen muss oeffnen');

    // Fuer alle anderen bleibt es zu.
    const anonRows = await h
      .as('anon', null)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    const outsider = await h
      .as('authenticated', unrated)
      .query(`select id from public.diary_entries where id = $1`, [id]);
    assert.deepEqual(anonRows, []);
    assert.deepEqual(outsider, []);

    await h.sql.query(`delete from public.follows`);
    await h.sql.query(`delete from public.diary_entries where id = $1`, [id]);
  });

  it('counts friends-only ratings toward the average but not private ones', async () => {
    const film = 'Q100003';
    await seedFilm(h, film);

    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
       values ($1, $3, 10, 'public'), ($2, $3, 8, 'friends')`,
      [rater, stranger, film],
    );
    const { rows: before } = await h.sql.query<{ average: string; votes: number }>(
      `select * from public.film_rating_summary($1)`,
      [film],
    );
    assert.equal(before[0]?.votes, 2, 'oeffentlich und Freunde zaehlen');
    assert.equal(Number(before[0]?.average), 9);

    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
       values ($1, $2, 2, 'private')`,
      [unrated, film],
    );
    const { rows: after } = await h.sql.query<{ average: string; votes: number }>(
      `select * from public.film_rating_summary($1)`,
      [film],
    );
    assert.equal(after[0]?.votes, 2, '"nur fuer mich" darf den Schnitt nicht bewegen');
    assert.equal(Number(after[0]?.average), 9);

    await h.sql.query(`delete from public.diary_entries where film_id = $1`, [film]);
  });

  it('lists mutual follows and nobody else', async () => {
    // rater folgt stranger, stranger folgt zurueck: Freunde.
    // rater folgt unrated einseitig: kein Freund.
    await h.sql.query(
      `insert into public.follows (follower_id, followee_id)
       values ($1, $2), ($2, $1), ($1, $3)`,
      [rater, stranger, unrated],
    );

    const mine = await h
      .as('authenticated', rater)
      .query<{ my_friends: string }>(`select * from public.my_friends()`);
    assert.deepEqual(
      mine.map((row) => row.my_friends),
      [stranger],
      'nur wer zurueckfolgt',
    );

    // Und aus der Gegenrichtung gesehen ebenso.
    const theirs = await h
      .as('authenticated', unrated)
      .query<{ my_friends: string }>(`select * from public.my_friends()`);
    assert.deepEqual(theirs, [], 'gefolgt zu werden macht niemanden zum Freund');

    const anonymous = await h.as('anon', null).query(`select * from public.my_friends()`);
    assert.deepEqual(anonymous, [], 'ohne Konto keine Freunde');

    await h.sql.query(`delete from public.follows`);
  });

  it('refuses a follow of oneself', async () => {
    const error = await h
      .as('authenticated', rater)
      .expectError(`insert into public.follows (follower_id, followee_id) values ($1, $1)`, [
        rater,
      ]);
    assert.match(String(error), /follows_not_self/);
  });

  it("refuses to follow on someone else's behalf", async () => {
    const error = await h
      .as('authenticated', rater)
      .expectError(`insert into public.follows (follower_id, followee_id) values ($1, $2)`, [
        stranger,
        unrated,
      ]);
    assert.match(String(error), /row-level security/);
  });
});

// ---------------------------------------------------------------------------

describe('rewatch', () => {
  it('marks the second entry for a film and leaves the first alone', async () => {
    const film = 'Q100004';
    await seedFilm(h, film);

    const first = await h.as('authenticated', rater).query<{ is_rewatch: boolean }>(
      `insert into public.diary_entries (user_id, film_id, rating)
         values ($1, $2, 6) returning is_rewatch`,
      [rater, film],
    );
    const second = await h.as('authenticated', rater).query<{ is_rewatch: boolean }>(
      `insert into public.diary_entries (user_id, film_id, rating)
         values ($1, $2, 9) returning is_rewatch`,
      [rater, film],
    );
    // Eine andere Person faengt bei sich selbst wieder von vorn an.
    const other = await h.as('authenticated', stranger).query<{ is_rewatch: boolean }>(
      `insert into public.diary_entries (user_id, film_id, rating)
         values ($1, $2, 4) returning is_rewatch`,
      [stranger, film],
    );

    assert.equal(first[0]?.is_rewatch, false);
    assert.equal(second[0]?.is_rewatch, true);
    assert.equal(other[0]?.is_rewatch, false);

    await h.sql.query(`delete from public.diary_entries where film_id = $1`, [film]);
  });
});

// ---------------------------------------------------------------------------

describe('diary and facet visibility', () => {
  it('hides a private entry from everyone but its owner', async () => {
    const rows = await h.as('authenticated', rater).query<{ id: string }>(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
         values ($1, $2, 3, 'private') returning id`,
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

  it('lets everyone read the four favourites but only the owner set them', async () => {
    const eigner = await seedUser(h, 'favoritler');

    await h
      .as('authenticated', eigner)
      .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 1)`, [
        eigner,
        FILM,
      ]);

    // Sie sind eine Visitenkarte: jeder liest sie, auch ohne Konto.
    const fremd = await h
      .as('authenticated', stranger)
      .query(`select film_id from public.favourites where user_id = $1`, [eigner]);
    const anonym = await h
      .as('anon', null)
      .query(`select film_id from public.favourites where user_id = $1`, [eigner]);
    assert.equal(fremd.length, 1, 'Favoriten sind oeffentlich');
    assert.equal(anonym.length, 1, 'auch ohne Anmeldung');

    // Aber niemand schreibt in ein fremdes Profil.
    await assert.rejects(
      () =>
        h
          .as('authenticated', stranger)
          .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 2)`, [
            eigner,
            QUIET_FILM,
          ]),
      /row-level security/,
      'ein Fremder darf keinen Platz belegen',
    );

    // Ein DELETE, das per RLS keine Zeile sieht, wirft nicht — es
    // loescht nichts. Der Nachweis ist deshalb die Zeile danach und
    // nicht die Ausnahme.
    await h
      .as('authenticated', stranger)
      .query(`delete from public.favourites where user_id = $1`, [eigner]);
    const nachDelete = await h
      .as('anon', null)
      .query(`select film_id from public.favourites where user_id = $1`, [eigner]);
    assert.equal(nachDelete.length, 1, 'der fremde Loeschversuch hat nichts getroffen');

    await h.sql.query(`delete from public.favourites where user_id = $1`, [eigner]);
  });

  it('holds four places, each once, each film once', async () => {
    const eigner = await seedUser(h, 'favoritgrenzen');

    await h
      .as('authenticated', eigner)
      .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 4)`, [
        eigner,
        FILM,
      ]);

    // Platz fuenf gibt es nicht.
    await assert.rejects(
      () =>
        h
          .as('authenticated', eigner)
          .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 5)`, [
            eigner,
            QUIET_FILM,
          ]),
      /favourites_position_check/,
      'vier Plaetze, nicht fuenf',
    );

    // Derselbe Film nicht zweimal.
    await assert.rejects(
      () =>
        h
          .as('authenticated', eigner)
          .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 3)`, [
            eigner,
            FILM,
          ]),
      /favourites_pkey/,
      'ein Film belegt hoechstens einen Platz',
    );

    // Und ein Platz nicht zweimal.
    await assert.rejects(
      () =>
        h
          .as('authenticated', eigner)
          .query(`insert into public.favourites (user_id, film_id, position) values ($1, $2, 4)`, [
            eigner,
            QUIET_FILM,
          ]),
      /favourites_one_film_per_place/,
      'ein Platz traegt hoechstens einen Film',
    );

    await h.sql.query(`delete from public.favourites where user_id = $1`, [eigner]);
  });

  it('swaps two places in one statement', async () => {
    const eigner = await seedUser(h, 'favorittausch');

    await h.sql.query(
      `insert into public.favourites (user_id, film_id, position)
       values ($1, $2, 1), ($1, $3, 2)`,
      [eigner, FILM, QUIET_FILM],
    );

    // Der eigentliche Grund fuer die aufgeschobene Bedingung: sofort
    // geprueft schluege der Zwischenschritt fehl, obwohl das Ergebnis
    // gueltig ist.
    await h.as('authenticated', eigner).query(
      `update public.favourites
          set position = case position when 1 then 2::smallint else 1::smallint end
        where user_id = $1 and position in (1, 2)`,
      [eigner],
    );

    const danach = await h
      .as('anon', null)
      .query<{ film_id: string; position: number }>(
        `select film_id, position from public.favourites where user_id = $1 order by position`,
        [eigner],
      );
    assert.deepEqual(
      danach.map((r) => r.film_id),
      [QUIET_FILM, FILM],
      'die beiden Plaetze haben getauscht',
    );

    await h.sql.query(`delete from public.favourites where user_id = $1`, [eigner]);
  });

  it('shows a public list to everyone and a private one to nobody else', async () => {
    const eigner = await seedUser(h, 'listenfuehrer');

    const [offen] = await h.as('authenticated', eigner).query<{ id: string }>(
      `insert into public.lists (user_id, title, is_public)
         values ($1, 'Filme im Regen', true) returning id`,
      [eigner],
    );
    const [zu] = await h.as('authenticated', eigner).query<{ id: string }>(
      `insert into public.lists (user_id, title, is_public)
         values ($1, 'Nur fuer mich', false) returning id`,
      [eigner],
    );

    assert.ok(offen && zu);

    await h.sql.query(
      `insert into public.list_items (list_id, film_id, ord) values ($1, $2, 1), ($3, $4, 1)`,
      [offen.id, FILM, zu.id, QUIET_FILM],
    );

    const fremdeListen = await h
      .as('authenticated', stranger)
      .query<{ id: string }>(`select id from public.lists where user_id = $1`, [eigner]);
    assert.deepEqual(
      fremdeListen.map((r) => r.id),
      [offen.id],
      'die private Liste taucht nicht einmal auf',
    );

    // Und ihr Inhalt auch nicht. Die Policy auf list_items haengt an der
    // Liste, nicht am Eintrag — sonst waere der Titel verborgen und die
    // Filme darin sichtbar.
    const fremdeEintraege = await h
      .as('authenticated', stranger)
      .query<{ film_id: string }>(`select film_id from public.list_items`);
    assert.deepEqual(
      fremdeEintraege.map((r) => r.film_id),
      [FILM],
      'der Inhalt der privaten Liste bleibt drin',
    );

    // Ohne Konto dasselbe.
    const anonym = await h.as('anon', null).query(`select film_id from public.list_items`);
    assert.equal(anonym.length, 1, 'oeffentlich heisst oeffentlich, privat heisst privat');

    const eigene = await h
      .as('authenticated', eigner)
      .query(`select id from public.lists where user_id = $1`, [eigner]);
    assert.equal(eigene.length, 2, 'der Besitzer sieht beide');

    await h.sql.query(`delete from public.lists where user_id = $1`, [eigner]);
  });

  it('lets nobody write into a list they do not own', async () => {
    const eigner = await seedUser(h, 'listenbesitzer');
    const [liste] = await h
      .as('authenticated', eigner)
      .query<{ id: string }>(
        `insert into public.lists (user_id, title) values ($1, 'Offen') returning id`,
        [eigner],
      );
    assert.ok(liste);

    // Lesbar ist sie, beschreibbar nicht. Das ist der ganze Punkt einer
    // oeffentlichen Liste.
    await assert.rejects(
      () =>
        h
          .as('authenticated', stranger)
          .query(`insert into public.list_items (list_id, film_id) values ($1, $2)`, [
            liste.id,
            FILM,
          ]),
      /row-level security/,
      'ein Fremder legt nichts hinein',
    );

    // Ein UPDATE, das per RLS keine Zeile sieht, wirft nicht — es
    // trifft nichts. Der Nachweis ist deshalb der Titel danach.
    await h
      .as('authenticated', stranger)
      .query(`update public.lists set title = 'Gekapert' where id = $1`, [liste.id]);
    const [titel] = await h
      .as('anon', null)
      .query<{ title: string }>(`select title from public.lists where id = $1`, [liste.id]);
    assert.equal(titel?.title, 'Offen', 'der Titel steht unveraendert');

    await h.sql.query(`delete from public.lists where user_id = $1`, [eigner]);
  });

  it('never puts an entry into the feed that the reader may not see', async () => {
    const autor = await seedUser(h, 'feedautor');
    const leser = await seedUser(h, 'feedleser');
    const dritter = await seedUser(h, 'feeddritter');

    // Einseitig: der Leser folgt, es wird nicht zurueckgefolgt. Damit
    // sind die beiden **keine** Freunde.
    await h.sql.query(`insert into public.follows (follower_id, followee_id) values ($1, $2)`, [
      leser,
      autor,
    ]);

    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
       values ($1, $2, 8, 'public'), ($1, $3, 7, 'private')`,
      [autor, FILM, QUIET_FILM],
    );

    const sichtbar = await h
      .as('authenticated', leser)
      .query<{ film_id: string }>(`select film_id from public.following_feed()`);
    assert.deepEqual(
      sichtbar.map((r) => r.film_id),
      [FILM],
      'der private Eintrag steht nicht im Feed',
    );

    // Und wer nicht folgt, sieht auch das Oeffentliche hier nicht — der
    // Feed ist die Auswahl der gefolgten Profile, nicht der Katalog.
    const ohneFolgen = await h
      .as('authenticated', dritter)
      .query(`select film_id from public.following_feed()`);
    assert.deepEqual(ohneFolgen, [], 'ohne Folgen ist der Feed leer');

    await h.sql.query(`delete from public.diary_entries where user_id = $1`, [autor]);
    await h.sql.query(`delete from public.follows where follower_id = $1`, [leser]);
  });

  it('counts only public ratings in the weekly top, and the same for everyone', async () => {
    // Eigene Filme, keine geteilten. `FILM` traegt die Bewertungen der
    // Tests davor — eine Rangliste ueber den ganzen Bestand haengt sonst
    // daran, welcher Test vorher lief.
    const laut = 'Q100901';
    const leise = 'Q100902';
    await seedFilm(h, laut);
    await seedFilm(h, leise);

    const einer = await seedUser(h, 'topeiner');
    const andere = await seedUser(h, 'topandere');
    const fremd = await seedUser(h, 'topfremd');

    // Zwei oeffentliche auf `laut`. Auf `leise` eine oeffentliche und
    // eine private — die private darf nicht zaehlen, sonst stuenden
    // beide gleichauf.
    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
       values ($1, $3, 8, 'public'),
              ($2, $3, 9, 'public'),
              ($1, $4, 10, 'public'),
              ($2, $4, 10, 'private')`,
      [einer, andere, laut, leise],
    );

    interface Zeile { place: number; wikidata_id: string; ratings: number; average: string }
    const gelesen = (rolle: 'anon' | 'authenticated', wer: string | null) =>
      h
        .as(rolle, wer)
        .query<Zeile>(
          `select place, wikidata_id, ratings, average from public.weekly_top_films(50)`,
        );

    const alsFremder = await gelesen('authenticated', fremd);
    const meine = alsFremder.filter((r) => r.wikidata_id === laut || r.wikidata_id === leise);

    assert.deepEqual(
      meine.map((r) => [r.wikidata_id, r.ratings]),
      [
        [laut, 2],
        [leise, 1],
      ],
      'die private Bewertung zaehlt nicht mit, und mehr Bewertungen stehen weiter oben',
    );

    // Die Plaetze sind eine lueckenlose Folge ab eins — das ist die
    // Zusicherung, die "Platz 1" ueberhaupt bedeutet.
    assert.deepEqual(
      alsFremder.map((r) => r.place),
      alsFremder.map((_, index) => index + 1),
      'die Plaetze zaehlen bei eins los und lassen keinen aus',
    );

    // Der Eigner der privaten Bewertung sieht dieselbe Liste. Waere die
    // Funktion allein der Policy ueberlassen, saehe er hier eine
    // andere — und "Top 10 dieser Woche" waere eine persoenliche
    // Auskunft statt einer Aussage ueber die Woche.
    assert.deepEqual(await gelesen('authenticated', andere), alsFremder, 'jeder sieht dasselbe');
    assert.deepEqual(await gelesen('anon', null), alsFremder, 'auch ohne Konto dasselbe');

    // Der Durchschnitt steht auf der internen Skala 1..10 — der Client
    // halbiert fuer die Sterne. Ein zweites Halbieren war im Web schon
    // einmal der Fehler.
    assert.equal(Number(meine[0]?.average), 8.5, 'der Durchschnitt ist (8+9)/2');

    await h.sql.query(`delete from public.diary_entries where film_id = any($1)`, [[laut, leise]]);
  });

  it('starts the week on Monday at midnight, German time', async () => {
    const film = 'Q100903';
    await seedFilm(h, film);
    const wer = await seedUser(h, 'topwoche');

    const enthalten = async () => {
      const zeilen = await h
        .as('anon', null)
        .query<{ wikidata_id: string }>(`select wikidata_id from public.weekly_top_films(50)`);
      return zeilen.some((r) => r.wikidata_id === film);
    };

    // Eine Sekunde **vor** dem Wochenanfang. Gehoert zur Woche davor.
    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility, created_at)
       values ($1, $2, 9, 'public',
               (date_trunc('week', (now() at time zone 'Europe/Berlin'))
                  at time zone 'Europe/Berlin') - interval '1 second')`,
      [wer, film],
    );
    assert.equal(await enthalten(), false, 'was vor Montag 00:00 liegt, zaehlt zur Woche davor');

    // Und genau **auf** dem Wochenanfang. Gehoert dazu.
    await h.sql.query(`delete from public.diary_entries where film_id = $1`, [film]);
    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating, visibility, created_at)
       values ($1, $2, 9, 'public',
               date_trunc('week', (now() at time zone 'Europe/Berlin'))
                 at time zone 'Europe/Berlin')`,
      [wer, film],
    );
    assert.equal(await enthalten(), true, 'Montag 00:00 gehoert zur laufenden Woche');

    await h.sql.query(`delete from public.diary_entries where film_id = $1`, [film]);
  });

  it('lets anyone file a report and only moderators read it', async () => {
    const melder = await seedUser(h, 'melder');
    const moderator = await seedUser(h, 'moderatorin');

    // Ohne Konto melden — Artikel 16 DSA verlangt genau das.
    await h.as('anon', null).query(
      `insert into public.reports (target_kind, target_id, reason, body, reporter_email)
       values ('message', $1, 'harassment', 'Beleidigend.', 'wer@example.org')`,
      ['00000000-0000-4000-8000-000000000001'],
    );

    // **Aber nicht mit `returning`.** Wer nicht lesen darf, darf auch
    // die eigene, gerade geschriebene Zeile nicht zurueklesen. Postgres
    // meldet das als "new row violates row-level security policy" und
    // fuehrt damit auf die falsche Faehrte — die Zeile war in Ordnung.
    //
    // Deshalb vergibt die Anwendung die Kennung selbst
    // (`report-actions.ts`), statt sie sich geben zu lassen.
    await assert.rejects(
      () =>
        h.as('anon', null).query(
          `insert into public.reports (target_kind, target_id, reason, reporter_email)
           values ('other', 'x', 'spam', 'wer@example.org') returning id`,
        ),
      /row-level security/,
      'zurueklesen darf der Melder nicht',
    );

    // Angemeldet ebenfalls, unter dem eigenen Namen.
    await h.as('authenticated', melder).query(
      `insert into public.reports (target_kind, target_id, reason, reporter_id)
       values ('review', $1, 'spam', $2)`,
      ['00000000-0000-4000-8000-000000000002', melder],
    );

    // Aber nicht in fremdem Namen: das waere ein Weg, ein Konto in
    // Verruf zu bringen.
    await assert.rejects(
      () =>
        h.as('authenticated', melder).query(
          `insert into public.reports (target_kind, target_id, reason, reporter_id)
           values ('review', $1, 'spam', $2)`,
          ['00000000-0000-4000-8000-000000000003', moderator],
        ),
      /row-level security/,
      'niemand meldet in fremdem Namen',
    );

    // Lesen darf sie niemand — auch nicht, wer selbst gemeldet hat.
    const alsMelder = await h.as('authenticated', melder).query(`select id from public.reports`);
    const alsAnon = await h.as('anon', null).query(`select id from public.reports`);
    assert.deepEqual(alsMelder, [], 'auch der Melder liest die Warteschlange nicht');
    assert.deepEqual(alsAnon, [], 'und ohne Konto erst recht nicht');

    // Erst als Moderator.
    await h.sql.query(`insert into public.moderators (user_id) values ($1)`, [moderator]);
    const alsModerator = await h
      .as('authenticated', moderator)
      .query(`select id from public.reports`);
    assert.equal(alsModerator.length, 2, 'der Moderator sieht beide');

    await h.sql.query(`delete from public.reports`);
    await h.sql.query(`delete from public.moderators where user_id = $1`, [moderator]);
  });

  it('never lets a user make themselves a moderator', async () => {
    const ehrgeizig = await seedUser(h, 'ehrgeizig');

    // Die Tabelle hat keine Schreib-Policy. Ohne Policy ist die Antwort
    // nein — und zwar fuer jeden, nicht nur fuer Fremde.
    await assert.rejects(
      () =>
        h
          .as('authenticated', ehrgeizig)
          .query(`insert into public.moderators (user_id) values ($1)`, [ehrgeizig]),
      /row-level security/,
      'niemand ernennt sich selbst',
    );

    const drin = await h
      .as('authenticated', ehrgeizig)
      .query(`select user_id from public.moderators`);
    assert.deepEqual(drin, [], 'und steht auch nicht drin');
  });

  it('keeps a report after the reported content is gone', async () => {
    const autor = await seedUser(h, 'geloeschter');
    const moderator = await seedUser(h, 'moderatorzwei');
    await h.sql.query(`insert into public.moderators (user_id) values ($1)`, [moderator]);

    const eingefuegt = await h.sql.query<{ id: string }>(
      `insert into public.diary_entries (user_id, film_id, rating, review, visibility)
       values ($1, $2, 6, 'Steht hier nicht lange.', 'public') returning id`,
      [autor, FILM],
    );
    const eintrag = eingefuegt.rows[0];
    assert.ok(eintrag);

    await h.as('anon', null).query(
      `insert into public.reports (target_kind, target_id, reason, reporter_email)
       values ('review', $1, 'hate', 'weg@example.org')`,
      [eintrag.id],
    );

    // Der gemeldete Inhalt verschwindet — die Meldung nicht. Deshalb
    // steht auf `target_id` kein Fremdschluessel: eine Kaskade wuerde
    // die Spur mitnehmen, und genau die ist der Zweck.
    await h.sql.query(`delete from public.diary_entries where id = $1`, [eintrag.id]);

    const uebrig = await h
      .as('authenticated', moderator)
      .query<{ target_id: string }>(`select target_id from public.reports`);
    assert.deepEqual(
      uebrig.map((r) => r.target_id),
      [eintrag.id],
      'die Meldung ueberlebt das Ziel',
    );

    await h.sql.query(`delete from public.reports`);
    await h.sql.query(`delete from public.moderators where user_id = $1`, [moderator]);
  });

  it('shows the account log to moderators and to the person it is about', async () => {
    const betroffen = await seedUser(h, 'betroffener');
    const fremd = await seedUser(h, 'unbeteiligter');
    const moderator = await seedUser(h, 'moderatordrei');
    await h.sql.query(`insert into public.moderators (user_id) values ($1)`, [moderator]);

    await h.sql.query(
      `insert into public.account_actions
         (target_id, target_name, actor_id, actor_name, action, reason)
       values ($1, 'betroffener', $2, 'moderatordrei', 'account_closed', 'Wiederholte Belaestigung.')`,
      [betroffen, moderator],
    );

    // Transparenz heisst: der Betroffene sieht, was mit seinem Konto
    // geschehen ist. Nicht nur der, der es getan hat.
    const eigene = await h
      .as('authenticated', betroffen)
      .query(`select id from public.account_actions`);
    assert.equal(eigene.length, 1, 'der Betroffene sieht seine Zeile');

    const alsModerator = await h
      .as('authenticated', moderator)
      .query(`select id from public.account_actions`);
    assert.equal(alsModerator.length, 1, 'der Moderator auch');

    const alsFremder = await h
      .as('authenticated', fremd)
      .query(`select id from public.account_actions`);
    assert.deepEqual(alsFremder, [], 'sonst niemand');

    // **Und niemand loescht.** Es gibt keine Delete-Policy, auch nicht
    // fuer Moderatoren: ein Logbuch mit Radiergummi ist keins.
    await h.as('authenticated', moderator).query(`delete from public.account_actions`);
    const danach = await h
      .as('authenticated', moderator)
      .query(`select id from public.account_actions`);
    assert.equal(danach.length, 1, 'die Zeile steht noch');

    // Und schreiben kann sie aus dem Browser auch niemand: die Eintraege
    // kommen ausschliesslich aus der Edge Function.
    await assert.rejects(
      () =>
        h.as('authenticated', moderator).query(
          `insert into public.account_actions
             (target_id, target_name, actor_id, actor_name, action, reason)
           values ($1, 'x', $2, 'y', 'note', 'Von Hand.')`,
          [betroffen, moderator],
        ),
      /row-level security/,
      'auch ein Moderator schreibt nicht direkt hinein',
    );

    await h.sql.query(`delete from public.account_actions`);
    await h.sql.query(`delete from public.moderators where user_id = $1`, [moderator]);
  });

  it('hides a blocked person from the discussion, for the blocker only', async () => {
    const stoerer = await seedUser(h, 'stoerer');
    const genervt = await seedUser(h, 'genervt');
    const unbeteiligt = await seedUser(h, 'unbeteiligt');

    // Alle drei haben den Film bewertet — sonst greift schon das
    // Spoiler-Gate und der Test bewiese das Falsche.
    for (const wer of [stoerer, genervt, unbeteiligt]) {
      await h.sql.query(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8)`,
        [wer, FILM],
      );
    }
    await h.sql.query(`update public.film_threads set is_active = true where film_id = $1`, [FILM]);

    // Auf diesem Film liegen aus frueheren Tests schon Beitraege.
    // Geprueft wird deshalb dieser eine, nicht die Gesamtzahl.
    const eingefuegt = await h.sql.query<{ id: string }>(
      `insert into public.thread_messages (film_id, user_id, body)
       values ($1, $2, 'Provokation.') returning id`,
      [FILM, stoerer],
    );
    const beitrag = eingefuegt.rows[0];
    assert.ok(beitrag);

    const sieht = async (wer: string) =>
      (
        await h
          .as('authenticated', wer)
          .query(`select id from public.thread_messages where id = $1`, [beitrag.id])
      ).length;

    assert.equal(await sieht(genervt), 1, 'vor dem Blockieren sichtbar');

    await h
      .as('authenticated', genervt)
      .query(`insert into public.blocks (blocker_id, blocked_id) values ($1, $2)`, [
        genervt,
        stoerer,
      ]);

    assert.equal(await sieht(genervt), 0, 'nach dem Blockieren nicht mehr');

    // **Einseitig.** Fuer alle anderen aendert sich nichts, und der
    // Blockierte sieht seinen Beitrag weiter.
    assert.equal(await sieht(unbeteiligt), 1, 'andere sehen den Beitrag weiter');
    assert.equal(await sieht(stoerer), 1, 'der Blockierte merkt nichts');

    // Und niemand sieht, wer wen blockiert hat.
    const fremdeSicht = await h
      .as('authenticated', stoerer)
      .query(`select blocker_id from public.blocks`);
    assert.deepEqual(fremdeSicht, [], 'Blockierungen sind privat');

    await h.sql.query(`delete from public.blocks`);
    await h.sql.query(`delete from public.thread_messages where id = $1`, [beitrag.id]);
    await h.sql.query(`delete from public.diary_entries where user_id = any($1::uuid[])`, [
      [stoerer, genervt, unbeteiligt],
    ]);
  });

  it('lets nobody write in a locked thread, and still lets everyone read', async () => {
    const schreiber = await seedUser(h, 'schreiber');

    await h.sql.query(
      `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 7)`,
      [schreiber, QUIET_FILM],
    );
    await h.sql.query(`update public.film_threads set is_active = true where film_id = $1`, [
      QUIET_FILM,
    ]);
    const vorSperre = await h.sql.query<{ id: string }>(
      `insert into public.thread_messages (film_id, user_id, body)
       values ($1, $2, 'Vor der Sperre.') returning id`,
      [QUIET_FILM, schreiber],
    );
    const alt = vorSperre.rows[0];
    assert.ok(alt);

    await h.sql.query(
      `update public.film_threads set is_locked = true, locked_reason = 'Zu hitzig.'
        where film_id = $1`,
      [QUIET_FILM],
    );

    await assert.rejects(
      () =>
        h.as('authenticated', schreiber).query(
          `insert into public.thread_messages (film_id, user_id, body)
           values ($1, $2, 'Nach der Sperre.')`,
          [QUIET_FILM, schreiber],
        ),
      /row-level security/,
      'in einem gesperrten Thread schreibt niemand',
    );

    // Lesen bleibt. Was dasteht, bleibt stehen — es kommt nur nichts
    // mehr dazu.
    const lesbar = await h
      .as('authenticated', schreiber)
      .query(`select id from public.thread_messages where id = $1`, [alt.id]);
    assert.equal(lesbar.length, 1, 'lesen geht weiter');

    await h.sql.query(
      `update public.film_threads set is_locked = false, locked_reason = null where film_id = $1`,
      [QUIET_FILM],
    );
    await h.sql.query(`delete from public.thread_messages where id = $1`, [alt.id]);
    await h.sql.query(`delete from public.diary_entries where user_id = $1`, [schreiber]);
  });

  it('keeps the watchlist private unless it is opened', async () => {
    await h
      .as('authenticated', rater)
      .query(`insert into public.watchlist (user_id, film_id) values ($1, $2)`, [
        rater,
        QUIET_FILM,
      ]);

    const otherRows = await h
      .as('authenticated', stranger)
      .query(`select film_id from public.watchlist`);
    const ownRows = await h
      .as('authenticated', rater)
      .query(`select film_id from public.watchlist`);

    assert.deepEqual(otherRows, []);
    assert.equal(ownRows.length, 1);
  });

  it('opens the watchlist only when the profile says so', async () => {
    const offen = await seedUser(h, 'offenerleser');
    await h.sql.query(
      `insert into public.watchlist (user_id, film_id, is_hidden)
       values ($1, $2, false), ($1, $3, true)`,
      [offen, FILM, QUIET_FILM],
    );

    // Noch zu: die Voreinstellung ist privat.
    const zu = await h
      .as('authenticated', stranger)
      .query(`select film_id from public.watchlist where user_id = $1`, [offen]);
    assert.deepEqual(zu, [], 'ohne Freigabe sieht niemand etwas');

    await h.sql.query(`update public.profiles set watchlist_public = true where id = $1`, [offen]);

    const sichtbar = await h
      .as('authenticated', stranger)
      .query<{ film_id: string }>(`select film_id from public.watchlist where user_id = $1`, [
        offen,
      ]);
    assert.deepEqual(
      sichtbar.map((r) => r.film_id),
      [FILM],
      'der einzeln ausgeblendete Titel bleibt auch bei offener Liste verborgen',
    );

    // Der Besitzer sieht beide, immer.
    const eigene = await h
      .as('authenticated', offen)
      .query(`select film_id from public.watchlist where user_id = $1`, [offen]);
    assert.equal(eigene.length, 2);

    // Und ohne Konto ebenfalls, wenn die Liste offen steht.
    const anonym = await h
      .as('anon', null)
      .query(`select film_id from public.watchlist where user_id = $1`, [offen]);
    assert.equal(anonym.length, 1, 'offen heisst offen, auch ohne Anmeldung');

    await h.sql.query(`delete from public.watchlist where user_id = $1`, [offen]);
  });

  it('lets nobody else change what is hidden', async () => {
    await h.sql.query(
      `insert into public.watchlist (user_id, film_id) values ($1, $2)
       on conflict do nothing`,
      [rater, FILM],
    );

    const rows = await h
      .as('authenticated', stranger)
      .query(`update public.watchlist set is_hidden = true where user_id = $1 returning film_id`, [
        rater,
      ]);
    assert.deepEqual(rows, [], 'fremde Zeilen bleiben unberuehrt');
  });

  it('makes facets follow the visibility of their entry', async () => {
    const pub = await h
      .as('authenticated', rater)
      .query<{ id: string }>(
        `insert into public.diary_entries (user_id, film_id, rating) values ($1, $2, 8) returning id`,
        [rater, FILM],
      );
    const priv = await h.as('authenticated', rater).query<{ id: string }>(
      `insert into public.diary_entries (user_id, film_id, rating, visibility)
         values ($1, $2, 8, 'private') returning id`,
      [rater, FILM],
    );

    await h.as('authenticated', rater).query(
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
