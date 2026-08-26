/**
 * M0 Definition of Done — the spoiler gate (ADR-010).
 *
 * The whole point of these tests is that they talk to the REST API
 * directly. Nothing here renders a component or filters a list in
 * JavaScript. If a row comes back, the gate is broken, no matter what the
 * UI would have done with it.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  admin,
  anonClient,
  createTestFilm,
  createTestUser,
  deleteTestFilm,
  deleteTestUser,
  uniqueFilmId,
  type TestUser,
} from './helpers.ts';

const FILM_ID = uniqueFilmId();

/** Rated their entry. Allowed to read and write. */
let rater: TestUser;
/** No entry at all. Must see nothing. */
let stranger: TestUser;
/** Logged the film but left the rating empty. Must also see nothing. */
let unrated: TestUser;
/** Fillers, only there to push viewer_count over the activation threshold. */
let fillers: TestUser[] = [];

let messageId: string;

before(async () => {
  await createTestFilm(FILM_ID);

  rater = await createTestUser('rater');
  stranger = await createTestUser('stranger');
  unrated = await createTestUser('unrated');
  fillers = [
    await createTestUser('fill1'),
    await createTestUser('fill2'),
    await createTestUser('fill3'),
  ];

  // rater + unrated + 3 fillers = 5 distinct viewers, which activates the
  // thread. Below five no thread exists at all (ADR-010).
  await rater.client.from('diary_entries').insert({
    user_id: rater.id,
    film_id: FILM_ID,
    rating: 8,
    watched_on: '2026-01-01',
  });
  await unrated.client.from('diary_entries').insert({
    user_id: unrated.id,
    film_id: FILM_ID,
    watched_on: '2026-01-02',
  });
  for (const filler of fillers) {
    await filler.client.from('diary_entries').insert({
      user_id: filler.id,
      film_id: FILM_ID,
      rating: 6,
    });
  }

  const { data: message, error } = await rater.client
    .from('thread_messages')
    .insert({ user_id: rater.id, film_id: FILM_ID, body: 'Das Ende erklaert alles davor.' })
    .select('id')
    .single();
  assert.equal(error, null, 'a rated user must be able to post');
  messageId = (message as { id: string }).id;
});

after(async () => {
  for (const user of [rater, stranger, unrated, ...fillers]) {
    if (user) await deleteTestUser(user);
  }
  await deleteTestFilm(FILM_ID);
});

describe('thread activation', () => {
  it('activates the thread at five distinct viewers', async () => {
    const { data } = await admin
      .from('film_threads')
      .select('viewer_count, is_active, message_count')
      .eq('film_id', FILM_ID)
      .single();

    const thread = data as { viewer_count: number; is_active: boolean; message_count: number };
    assert.equal(thread.viewer_count, 5);
    assert.equal(thread.is_active, true);
    assert.equal(thread.message_count, 1);
  });

  it('counts a rewatch as one viewer, not two', async () => {
    await rater.client
      .from('diary_entries')
      .insert({ user_id: rater.id, film_id: FILM_ID, rating: 9, is_rewatch: true });

    const { data } = await admin
      .from('film_threads')
      .select('viewer_count')
      .eq('film_id', FILM_ID)
      .single();

    assert.equal((data as { viewer_count: number }).viewer_count, 5);
  });
});

describe('read gate', () => {
  it('returns zero rows to an anonymous caller', async () => {
    const { data, error } = await anonClient()
      .from('thread_messages')
      .select('id, body')
      .eq('film_id', FILM_ID);

    assert.equal(error, null);
    assert.deepEqual(data, [], 'anon must get an empty set, not a filtered view');
  });

  it('returns zero rows to a user with no entry for the film', async () => {
    const { data, error } = await stranger.client
      .from('thread_messages')
      .select('id, body')
      .eq('film_id', FILM_ID);

    assert.equal(error, null);
    assert.deepEqual(data, []);
  });

  it('returns zero rows to a user whose entry has no rating', async () => {
    const { data, error } = await unrated.client
      .from('thread_messages')
      .select('id, body')
      .eq('film_id', FILM_ID);

    assert.equal(error, null);
    assert.deepEqual(data, [], 'logging alone must not open the discussion');
  });

  it('does not leak the body through a targeted single-row fetch', async () => {
    const { data } = await stranger.client
      .from('thread_messages')
      .select('body')
      .eq('id', messageId);

    assert.deepEqual(data, []);
  });

  it('does not leak the body through an embedded join', async () => {
    const { data } = await stranger.client
      .from('films')
      .select('wikidata_id, thread_messages(body)')
      .eq('wikidata_id', FILM_ID)
      .single();

    const row = data as { thread_messages: unknown[] } | null;
    assert.deepEqual(row?.thread_messages, []);
  });

  it('returns the message once the user has rated the film', async () => {
    const { data, error } = await rater.client
      .from('thread_messages')
      .select('id, body')
      .eq('film_id', FILM_ID);

    assert.equal(error, null);
    assert.equal(data?.length, 1);
  });

  it('opens the gate the moment a rating is added to an existing entry', async () => {
    await unrated.client
      .from('diary_entries')
      .update({ rating: 5 })
      .eq('user_id', unrated.id)
      .eq('film_id', FILM_ID);

    const { data } = await unrated.client
      .from('thread_messages')
      .select('id')
      .eq('film_id', FILM_ID);

    assert.equal(data?.length, 1);

    // Restore the ungated state for any later run against the same fixture.
    await unrated.client
      .from('diary_entries')
      .update({ rating: null })
      .eq('user_id', unrated.id)
      .eq('film_id', FILM_ID);
  });
});

describe('write gate', () => {
  it('rejects a post from a user with no entry', async () => {
    const { error } = await stranger.client
      .from('thread_messages')
      .insert({ user_id: stranger.id, film_id: FILM_ID, body: 'Ich habe ihn nicht gesehen.' });

    assert.notEqual(error, null, 'insert must be denied by RLS');
  });

  it('rejects a post written in someone else than the caller', async () => {
    const { error } = await rater.client
      .from('thread_messages')
      .insert({ user_id: stranger.id, film_id: FILM_ID, body: 'Nicht mein Beitrag.' });

    assert.notEqual(error, null);
  });

  it('rejects a post to a film whose thread is not active', async () => {
    const quietFilm = uniqueFilmId();
    await createTestFilm(quietFilm);
    try {
      await rater.client
        .from('diary_entries')
        .insert({ user_id: rater.id, film_id: quietFilm, rating: 7 });

      const { error } = await rater.client
        .from('thread_messages')
        .insert({ user_id: rater.id, film_id: quietFilm, body: 'Erster.' });

      assert.notEqual(error, null, 'a thread below five viewers must not accept posts');
    } finally {
      await deleteTestFilm(quietFilm);
    }
  });

  it('rejects a reply pointing at a message about a different film', async () => {
    const otherFilm = uniqueFilmId();
    await createTestFilm(otherFilm);
    try {
      const { error } = await rater.client.from('thread_messages').insert({
        user_id: rater.id,
        film_id: otherFilm,
        parent_id: messageId,
        body: 'Falscher Film.',
      });

      assert.notEqual(error, null);
    } finally {
      await deleteTestFilm(otherFilm);
    }
  });
});

describe('rate limit', () => {
  it('stops the eleventh message within an hour', async () => {
    const limited = await createTestUser('limited');
    try {
      await limited.client
        .from('diary_entries')
        .insert({ user_id: limited.id, film_id: FILM_ID, rating: 7 });

      let lastError: unknown = null;
      for (let i = 0; i < 11; i++) {
        const { error } = await limited.client
          .from('thread_messages')
          .insert({ user_id: limited.id, film_id: FILM_ID, body: `Beitrag ${String(i)}` });
        lastError = error;
        if (error && i < 10) {
          assert.fail(`message ${String(i)} was rejected before the limit: ${String(error)}`);
        }
      }

      assert.notEqual(lastError, null, 'the eleventh message must be rejected');
    } finally {
      await deleteTestUser(limited);
    }
  });
});

describe('message immutability', () => {
  it('cannot be reassigned to another user', async () => {
    await rater.client
      .from('thread_messages')
      .update({ user_id: stranger.id })
      .eq('id', messageId);

    const { data } = await admin
      .from('thread_messages')
      .select('user_id')
      .eq('id', messageId)
      .single();

    assert.equal((data as { user_id: string }).user_id, rater.id);
  });

  it('stamps edited_at server-side when the body changes', async () => {
    await rater.client
      .from('thread_messages')
      .update({ body: 'Korrigiert.' })
      .eq('id', messageId);

    const { data } = await admin
      .from('thread_messages')
      .select('edited_at')
      .eq('id', messageId)
      .single();

    assert.notEqual((data as { edited_at: string | null }).edited_at, null);
  });
});
