/**
 * M0 Definition of Done — the catalog is read-only for everyone except
 * the import pipeline, and private diary entries stay private.
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
let owner: TestUser;
let other: TestUser;

before(async () => {
  await createTestFilm(FILM_ID);
  owner = await createTestUser('owner');
  other = await createTestUser('other');
});

after(async () => {
  for (const user of [owner, other]) {
    if (user) await deleteTestUser(user);
  }
  await deleteTestFilm(FILM_ID);
});

describe('catalog is read-only', () => {
  const catalogTables = ['films', 'people', 'film_credits', 'genres', 'film_genres'] as const;

  it('lets anyone read films', async () => {
    const { data, error } = await anonClient()
      .from('films')
      .select('wikidata_id')
      .eq('wikidata_id', FILM_ID);

    assert.equal(error, null);
    assert.equal(data?.length, 1);
  });

  it('rejects an insert into films with the anon key', async () => {
    const { error } = await anonClient()
      .from('films')
      .insert({ wikidata_id: uniqueFilmId(), title_original: 'Untergeschoben' });

    assert.notEqual(error, null, 'the anon key must not be able to write the catalog');
  });

  it('rejects an insert into films from a signed-in user', async () => {
    const { error } = await owner.client
      .from('films')
      .insert({ wikidata_id: uniqueFilmId(), title_original: 'Untergeschoben' });

    assert.notEqual(error, null);
  });

  it('rejects updates and deletes on films', async () => {
    const { error: updateError } = await owner.client
      .from('films')
      .update({ title_de: 'Umbenannt' })
      .eq('wikidata_id', FILM_ID);
    const { error: deleteError } = await owner.client
      .from('films')
      .delete()
      .eq('wikidata_id', FILM_ID);

    // PostgREST reports a no-op rather than an error when zero rows match
    // the policy, so verify the row is untouched instead of trusting the
    // error channel alone.
    const { data } = await admin
      .from('films')
      .select('title_de')
      .eq('wikidata_id', FILM_ID)
      .single();

    assert.equal((data as { title_de: string }).title_de, 'RLS-Vorrichtung');
    void updateError;
    void deleteError;
  });

  for (const table of catalogTables) {
    it(`rejects an insert into ${table} with the anon key`, async () => {
      const { error } = await anonClient().from(table).insert({});
      assert.notEqual(error, null);
    });
  }
});

describe('diary visibility', () => {
  it('shows a public entry to everyone', async () => {
    await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 7, watched_on: '2026-02-01' });

    const { data } = await anonClient()
      .from('diary_entries')
      .select('id')
      .eq('film_id', FILM_ID)
      .eq('user_id', owner.id);

    assert.equal(data?.length, 1);
  });

  it('hides a private entry from anon and from other users', async () => {
    const { data: created } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 3, is_private: true })
      .select('id')
      .single();
    const privateId = (created as { id: string }).id;

    const { data: anonRows } = await anonClient()
      .from('diary_entries')
      .select('id')
      .eq('id', privateId);
    const { data: otherRows } = await other.client
      .from('diary_entries')
      .select('id')
      .eq('id', privateId);
    const { data: ownRows } = await owner.client
      .from('diary_entries')
      .select('id')
      .eq('id', privateId);

    assert.deepEqual(anonRows, []);
    assert.deepEqual(otherRows, []);
    assert.equal(ownRows?.length, 1, 'the owner must still see their own private entry');
  });

  it('rejects an entry written in someone else than the caller', async () => {
    const { error } = await other.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 1 });

    assert.notEqual(error, null);
  });

  it('rejects a rating outside 1..10', async () => {
    const { error } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 11 });

    assert.notEqual(error, null);
  });
});

describe('watchlist is private', () => {
  it('is invisible to other users', async () => {
    await owner.client.from('watchlist').insert({ user_id: owner.id, film_id: FILM_ID });

    const { data: otherRows } = await other.client
      .from('watchlist')
      .select('film_id')
      .eq('user_id', owner.id);
    const { data: anonRows } = await anonClient()
      .from('watchlist')
      .select('film_id')
      .eq('user_id', owner.id);
    const { data: ownRows } = await owner.client.from('watchlist').select('film_id');

    assert.deepEqual(otherRows, []);
    assert.deepEqual(anonRows, []);
    assert.equal(ownRows?.length, 1);
  });
});

describe('facet ratings follow their entry', () => {
  it('are readable when the entry is public and hidden when it is not', async () => {
    const { data: publicEntry } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 8 })
      .select('id')
      .single();
    const { data: privateEntry } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 8, is_private: true })
      .select('id')
      .single();

    const publicId = (publicEntry as { id: string }).id;
    const privateId = (privateEntry as { id: string }).id;

    await owner.client.from('entry_facet_ratings').insert([
      { entry_id: publicId, facet: 'cinematography', score: 9 },
      { entry_id: privateId, facet: 'story', score: 2 },
    ]);

    const { data: visible } = await anonClient()
      .from('entry_facet_ratings')
      .select('facet')
      .eq('entry_id', publicId);
    const { data: hidden } = await anonClient()
      .from('entry_facet_ratings')
      .select('facet')
      .eq('entry_id', privateId);

    assert.equal(visible?.length, 1);
    assert.deepEqual(hidden, []);
  });

  it('rejects a facet on someone else’s entry', async () => {
    const { data: entry } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 4 })
      .select('id')
      .single();

    const { error } = await other.client
      .from('entry_facet_ratings')
      .insert({ entry_id: (entry as { id: string }).id, facet: 'acting', score: 10 });

    assert.notEqual(error, null);
  });

  it('rejects a facet outside the enum', async () => {
    const { data: entry } = await owner.client
      .from('diary_entries')
      .insert({ user_id: owner.id, film_id: FILM_ID, rating: 4 })
      .select('id')
      .single();

    const { error } = await owner.client
      .from('entry_facet_ratings')
      // Deliberately invalid: the enum is the guarantee that aggregation
      // stays possible (ADR-009).
      .insert({ entry_id: (entry as { id: string }).id, facet: 'vibes', score: 10 } as never);

    assert.notEqual(error, null);
  });
});
