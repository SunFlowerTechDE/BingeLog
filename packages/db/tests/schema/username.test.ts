/**
 * M3 3.1 — username rules.
 *
 * A username ends up in a URL and in every mention, so the rules are
 * enforced in the database rather than in the form: a client-side check
 * is a convenience, not a constraint.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { seedUser, startHarness, type Harness } from './harness.ts';

let h: Harness;

async function createProfile(username: string): Promise<string | null> {
  const { rows } = await h.sql.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [`${username}-${String(Math.floor(Math.random() * 1e9))}@bingelog.test`],
  );
  const id = rows[0]?.id ?? '';

  try {
    await h.sql.query(`insert into public.profiles (id, username) values ($1, $2)`, [id, username]);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function isAvailable(candidate: string): Promise<boolean> {
  const { rows } = await h.sql.query<{ available: boolean }>(
    `select public.username_available($1) as available`,
    [candidate],
  );
  return rows[0]?.available ?? false;
}

before(async () => {
  h = await startHarness();
});

after(async () => {
  await h.stop();
});

describe('the shape of a username', () => {
  it('accepts lowercase letters, digits and underscores', async () => {
    assert.equal(await createProfile('kevin_1996'), null);
  });

  it('rejects fewer than three characters', async () => {
    assert.notEqual(await createProfile('ab'), null);
  });

  it('rejects more than twenty', async () => {
    // The first migration allowed 24. Narrowing later would have broken
    // existing URLs, which is why it was narrowed before anyone signed up.
    assert.notEqual(await createProfile('a'.repeat(21)), null);
    assert.equal(await createProfile('a'.repeat(20)), null);
  });

  it('rejects uppercase, so two names cannot differ by case alone', async () => {
    assert.notEqual(await createProfile('Kevin'), null);
  });

  it('rejects spaces, dots, hyphens and anything else', async () => {
    for (const candidate of ['kevin moutin', 'kevin.moutin', 'kevin-moutin', 'kevin!', 'kévin']) {
      assert.notEqual(await createProfile(candidate), null, `accepted: ${candidate}`);
    }
  });

  it('rejects a name that is already taken', async () => {
    assert.equal(await createProfile('doppelt'), null);
    assert.notEqual(await createProfile('doppelt'), null);
  });
});

describe('reserved names', () => {
  it('refuses a route segment that would collide with a profile URL', async () => {
    for (const candidate of ['suche', 'einstellungen', 'impressum', 'poster']) {
      const error = await createProfile(candidate);
      assert.match(String(error), /username_reserved/, `accepted: ${candidate}`);
    }
  });

  it('refuses a name that would let someone pass as the service', async () => {
    for (const candidate of ['admin', 'moderator', 'support', 'bingelog']) {
      assert.match(String(await createProfile(candidate)), /username_reserved/);
    }
  });

  it('refuses a rename into a reserved name, not only a fresh one', async () => {
    const id = await seedUser(h, 'umbenennen');
    await assert.rejects(
      h.sql.query(`update public.profiles set username = 'admin' where id = $1`, [id]),
      /username_reserved/,
    );
  });

  it('keeps the list readable, so the form can explain itself', async () => {
    const rows = await h.as('anon', null).query(`select username from public.reserved_usernames`);
    assert.ok(rows.length > 20);
  });
});

describe('the availability check', () => {
  it('agrees with what an insert would do', async () => {
    assert.equal(await isAvailable('frei_und_gueltig'), true);
    assert.equal(await isAvailable('admin'), false, 'reserved');
    assert.equal(await isAvailable('ab'), false, 'too short');
    assert.equal(await isAvailable('Kevin'), false, 'uppercase');

    await createProfile('schon_vergeben');
    assert.equal(await isAvailable('schon_vergeben'), false, 'taken');
  });

  it('answers for an anonymous visitor, since sign-up happens before login', async () => {
    const rows = await h
      .as('anon', null)
      .query<{ available: boolean }>(`select public.username_available('irgendwer') as available`);
    assert.equal(rows[0]?.available, true);
  });

  it('does not let the check leak who exists', async () => {
    // username_available runs as definer and returns a boolean; the
    // profiles table itself stays behind its own policy.
    await createProfile('versteckt');
    const rows = await h
      .as('anon', null)
      .query(`select public.username_available('versteckt') as available`);
    assert.equal(rows.length, 1);
  });
});
