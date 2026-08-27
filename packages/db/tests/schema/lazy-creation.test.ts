/**
 * M1 1.5 — the rate limit on lazy creation.
 *
 * Wikidata is a donated service and the roadmap asks for a few queries
 * per minute at most. The limit lives in the database because an edge
 * function is stateless and several can run at once — a counter in one
 * of them would only ever see its own requests.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness, type Harness } from './harness.ts';

let h: Harness;

async function claim(term: string, perMinute = 3): Promise<boolean> {
  const { rows } = await h.sql.query<{ ok: boolean }>(
    `select public.claim_lazy_creation($1, $2) as ok`,
    [term, perMinute],
  );
  return rows[0]?.ok ?? false;
}

before(async () => {
  h = await startHarness();
});

after(async () => {
  await h.stop();
});

describe('claiming a lookup', () => {
  it('allows the first few and then stops', async () => {
    assert.equal(await claim('erster'), true);
    assert.equal(await claim('zweiter'), true);
    assert.equal(await claim('dritter'), true);
    assert.equal(await claim('vierter'), false, 'the fourth within a minute must be refused');
  });

  it('counts across terms, not per term', async () => {
    // Otherwise a caller varies the search term and the limit is gone.
    await h.sql.query('delete from public.lazy_creation_attempts');
    assert.equal(await claim('a'), true);
    assert.equal(await claim('b'), true);
    assert.equal(await claim('c'), true);
    assert.equal(await claim('d'), false);
  });

  it('lets attempts age out of the window', async () => {
    await h.sql.query(
      `update public.lazy_creation_attempts set created_at = now() - interval '2 minutes'`,
    );
    assert.equal(await claim('spaeter'), true);
  });

  it('records the attempt only when it was allowed', async () => {
    await h.sql.query('delete from public.lazy_creation_attempts');
    await claim('eins', 1);
    await claim('zwei', 1); // refused

    const { rows } = await h.sql.query<{ term: string }>(
      'select term from public.lazy_creation_attempts',
    );
    assert.deepEqual(
      rows.map((r) => r.term),
      ['eins'],
      'a refused attempt must not count against the next caller',
    );
  });

  it('truncates a very long term rather than storing it whole', async () => {
    await h.sql.query('delete from public.lazy_creation_attempts');
    await claim('x'.repeat(5000), 10);

    const { rows } = await h.sql.query<{ len: number }>(
      'select length(term) as len from public.lazy_creation_attempts',
    );
    assert.ok((rows[0]?.len ?? 0) <= 200);
  });
});

describe('who may read the attempts', () => {
  it('is nobody but the service role', async () => {
    // The table is a rate-limit window, not a search log. What people
    // looked for is not something other users get to browse (ADR-007).
    const asAnon = await h.as('anon', null).query('select * from public.lazy_creation_attempts');
    assert.deepEqual(asAnon, []);

    const { rows } = await h.sql.query<{ n: string }>(
      `select count(*) as n from pg_policies
       where schemaname = 'public' and tablename = 'lazy_creation_attempts'`,
    );
    assert.equal(Number(rows[0]?.n), 0, 'no policies at all, so nothing is readable');
  });

  it('prunes what has aged out', async () => {
    await h.sql.query(
      `insert into public.lazy_creation_attempts (term, created_at)
       values ('alt', now() - interval '2 hours')`,
    );
    await h.sql.query('select public.prune_lazy_creation_attempts()');

    const { rows } = await h.sql.query<{ n: string }>(
      `select count(*) as n from public.lazy_creation_attempts where term = 'alt'`,
    );
    assert.equal(Number(rows[0]?.n), 0);
  });
});
