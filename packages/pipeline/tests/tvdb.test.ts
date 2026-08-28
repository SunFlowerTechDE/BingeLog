/**
 * M2 2.2 — the artwork layer.
 *
 * The client is tested against an injected fetch so the assertions cover
 * behaviour rather than TheTVDB's uptime. The batch runs against the real
 * schema on an ephemeral Postgres, because what matters there is which
 * rows it selects and what it writes back.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { startHarness, type Harness } from '@binge-log/db/testing';

import { createTvdbClient } from '../src/tvdb/client.ts';
import { markUnmatchable, runArtworkBatch, formatProgress } from '../src/tvdb/batch.ts';

// ---------------------------------------------------------------------------
// A stand-in for TheTVDB, shaped like the real responses.
// ---------------------------------------------------------------------------

interface StubOptions {
  movies?: Record<string, { id: number; image?: string | null }>;
  failOn?: Set<string>;
  expireFirstToken?: boolean;
}

function stubTvdb(options: StubOptions = {}) {
  const { movies = {}, failOn = new Set<string>(), expireFirstToken = false } = options;
  const calls: string[] = [];
  let logins = 0;

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    calls.push(href);

    if (href.endsWith('/login')) {
      logins++;
      const body = JSON.parse(String(init?.body ?? '{}')) as { apikey?: string };
      if (body.apikey !== 'valid-key') {
        return new Response('nope', { status: 401, statusText: 'Unauthorized' });
      }
      return Response.json({ data: { token: `token-${String(logins)}` } });
    }

    const imdbId = href.split('/').at(-1) ?? '';

    if (expireFirstToken && init?.headers && 'Authorization' in (init.headers as object)) {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (auth === 'Bearer token-1') {
        return new Response('expired', { status: 401, statusText: 'Unauthorized' });
      }
    }

    if (failOn.has(imdbId)) {
      return new Response('boom', { status: 500, statusText: 'Server Error' });
    }

    const movie = movies[imdbId];
    if (!movie) return Response.json({ status: 'success', data: [] });

    return Response.json({ status: 'success', data: [{ movie }] });
  }) as unknown as typeof fetch;

  return { fetchImpl, calls, loginCount: () => logins };
}

const NO_WAIT = { minIntervalMs: 0, sleep: async (): Promise<void> => undefined };

// ---------------------------------------------------------------------------

describe('the TheTVDB client', () => {
  it('finds a film by its IMDb id', async () => {
    const stub = stubTvdb({
      movies: { tt0069293: { id: 7063, image: 'https://artworks.thetvdb.com/x.jpg' } },
    });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    const match = await client.findByImdbId('tt0069293');

    assert.deepEqual(match, { tvdbId: 7063, posterUrl: 'https://artworks.thetvdb.com/x.jpg' });
    assert.ok(stub.calls.some((c) => c.includes('/search/remoteid/tt0069293')));
  });

  it('only ever calls the remoteid endpoint', async () => {
    const stub = stubTvdb({ movies: { tt0069293: { id: 7063 } } });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    await client.findByImdbId('tt0069293');
    await client.findByImdbId('tt9999999');

    // ADR-003: a title search must not exist, not even as a fallback.
    for (const call of stub.calls) {
      assert.ok(
        call.endsWith('/login') || call.includes('/search/remoteid/'),
        `unexpected endpoint: ${call}`,
      );
      assert.ok(!call.includes('query='), 'no title search');
    }
  });

  it('returns null for an unknown id rather than guessing', async () => {
    const stub = stubTvdb({ movies: {} });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    assert.equal(await client.findByImdbId('tt1234567'), null);
  });

  it('ignores a hit that is a series rather than a movie', async () => {
    const fetchImpl = (async (url: string | URL | Request) => {
      if (String(url).endsWith('/login')) return Response.json({ data: { token: 't' } });
      return Response.json({ data: [{ series: { id: 999, image: 'x' } }] });
    }) as unknown as typeof fetch;

    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl, ...NO_WAIT });

    // Two databases disagreeing about what an id is would be exactly the
    // silent mislink ADR-003 guards against.
    assert.equal(await client.findByImdbId('tt0069293'), null);
  });

  it('reports a film without artwork as a match with no poster', async () => {
    const stub = stubTvdb({ movies: { tt0069293: { id: 7063, image: null } } });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    assert.deepEqual(await client.findByImdbId('tt0069293'), { tvdbId: 7063, posterUrl: null });
  });

  it('refuses anything that is not an IMDb title id', async () => {
    const stub = stubTvdb();
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    await assert.rejects(() => client.findByImdbId('nm0000040'));
    await assert.rejects(() => client.findByImdbId('Solaris'));
    assert.deepEqual(stub.calls, [], 'nothing may reach the network');
  });

  it('logs in once and reuses the token', async () => {
    const stub = stubTvdb({ movies: { tt0000001: { id: 1 }, tt0000002: { id: 2 } } });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    await client.findByImdbId('tt0000001');
    await client.findByImdbId('tt0000002');

    assert.equal(stub.loginCount(), 1);
  });

  it('logs in again when the token has expired', async () => {
    const stub = stubTvdb({ movies: { tt0000001: { id: 1 } }, expireFirstToken: true });
    const client = createTvdbClient({ apiKey: 'valid-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    const match = await client.findByImdbId('tt0000001');

    assert.equal(stub.loginCount(), 2);
    assert.equal(match?.tvdbId, 1);
  });

  it('fails loudly on a rejected key instead of looping', async () => {
    const stub = stubTvdb();
    const client = createTvdbClient({ apiKey: 'wrong-key', fetchImpl: stub.fetchImpl, ...NO_WAIT });

    await assert.rejects(() => client.findByImdbId('tt0000001'), /login failed/);
  });

  it('spaces requests apart', async () => {
    const stub = stubTvdb({ movies: { tt0000001: { id: 1 }, tt0000002: { id: 2 } } });
    const waits: number[] = [];
    let clock = 0;

    const client = createTvdbClient({
      apiKey: 'valid-key',
      fetchImpl: stub.fetchImpl,
      minIntervalMs: 200,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });

    await client.findByImdbId('tt0000001');
    await client.findByImdbId('tt0000002');

    assert.ok(
      waits.some((w) => w > 0),
      'the second request must wait',
    );
  });
});

// ---------------------------------------------------------------------------

describe('the artwork batch', () => {
  let h: Harness;

  before(async () => {
    h = await startHarness();
  });

  after(async () => {
    await h.stop();
  });

  async function seed(films: [id: string, imdb: string | null, sitelinks: number][]) {
    await h.sql.query('delete from public.films');
    for (const [id, imdb, sitelinks] of films) {
      await h.sql.query(
        `insert into public.films (wikidata_id, imdb_id, title_original, sitelink_count)
         values ($1, $2, 'Fixture', $3)`,
        [id, imdb, sitelinks],
      );
    }
  }

  function client(options: StubOptions) {
    return createTvdbClient({
      apiKey: 'valid-key',
      fetchImpl: stubTvdb(options).fetchImpl,
      ...NO_WAIT,
    });
  }

  it('records a hit as tvdb and a miss as generated', async () => {
    await seed([
      ['Q1', 'tt0000001', 50],
      ['Q2', 'tt0000002', 10],
    ]);

    const progress = await runArtworkBatch(
      h.sql,
      client({ movies: { tt0000001: { id: 7063, image: 'https://artworks.thetvdb.com/a.jpg' } } }),
    );

    assert.equal(progress.matched, 1);
    assert.equal(progress.generated, 1);

    const { rows } = await h.sql.query<{
      wikidata_id: string;
      tvdb_id: number | null;
      poster_source: string;
      poster_url: string | null;
    }>(
      'select wikidata_id, tvdb_id, poster_source, poster_url from public.films order by wikidata_id',
    );

    assert.equal(rows[0]?.poster_source, 'tvdb');
    assert.equal(rows[0]?.tvdb_id, 7063);
    assert.match(String(rows[0]?.poster_url), /^https:\/\/artworks\.thetvdb\.com\//);

    assert.equal(rows[1]?.poster_source, 'generated');
    assert.equal(rows[1]?.tvdb_id, null);
  });

  it('skips films without an IMDb id entirely', async () => {
    await seed([['Q1', null, 90]]);

    const progress = await runArtworkBatch(h.sql, client({}));

    assert.equal(progress.processed, 0, 'no id means no lookup, ADR-003');
    const { rows } = await h.sql.query<{ poster_source: string | null }>(
      'select poster_source from public.films',
    );
    assert.equal(rows[0]?.poster_source, null);
  });

  it('works through the catalog in relevance order', async () => {
    await seed([
      ['Q1', 'tt0000001', 3],
      ['Q2', 'tt0000002', 90],
      ['Q3', 'tt0000003', 40],
    ]);

    await runArtworkBatch(h.sql, client({ movies: { tt0000002: { id: 2 } } }), { limit: 1 });

    const { rows } = await h.sql.query<{ wikidata_id: string }>(
      `select wikidata_id from public.films where poster_source is not null`,
    );
    assert.deepEqual(
      rows.map((r) => r.wikidata_id),
      ['Q2'],
      'the most linked film is served first (ADR-008)',
    );
  });

  it('leaves a failed film for the next run instead of writing a wrong answer', async () => {
    await seed([['Q1', 'tt0000001', 10]]);

    const progress = await runArtworkBatch(h.sql, client({ failOn: new Set(['tt0000001']) }));

    assert.equal(progress.failed, 1);
    const { rows } = await h.sql.query<{ poster_source: string | null }>(
      'select poster_source from public.films',
    );
    assert.equal(rows[0]?.poster_source, null, 'a transport error is not a "generated"');
  });

  it('resumes where it stopped and never redoes settled films', async () => {
    await seed([
      ['Q1', 'tt0000001', 50],
      ['Q2', 'tt0000002', 40],
      ['Q3', 'tt0000003', 30],
    ]);
    const movies = { tt0000001: { id: 1 }, tt0000002: { id: 2 }, tt0000003: { id: 3 } };

    const first = await runArtworkBatch(h.sql, client({ movies }), { limit: 2 });
    assert.equal(first.processed, 2);

    const second = await runArtworkBatch(h.sql, client({ movies }));
    assert.equal(second.processed, 1, 'only the untouched film is picked up again');

    const third = await runArtworkBatch(h.sql, client({ movies }));
    assert.equal(third.processed, 0, 'nothing left to do');
  });

  it('does not spin forever when every request fails', async () => {
    await seed([
      ['Q1', 'tt0000001', 10],
      ['Q2', 'tt0000002', 9],
    ]);

    const progress = await runArtworkBatch(
      h.sql,
      client({ failOn: new Set(['tt0000001', 'tt0000002']) }),
      { batchSize: 2 },
    );

    assert.equal(progress.failed, 2);
    assert.equal(progress.processed, 2);
  });

  it('gives a film without an IMDb id its card instead of leaving it undecided', async () => {
    await seed([
      ['Q1', null, 90],
      ['Q2', 'tt0000002', 10],
    ]);

    await runArtworkBatch(h.sql, client({ movies: { tt0000002: { id: 2 } } }));
    const marked = await markUnmatchable(h.sql);

    assert.equal(marked, 1);

    // M2's Definition of Done: no film may be left without a decision.
    const { rows } = await h.sql.query<{ n: string }>(
      `select count(*) as n from public.films where poster_source is null`,
    );
    assert.equal(Number(rows[0]?.n), 0);
  });

  it('does not overwrite a decision that was already made', async () => {
    await seed([['Q1', null, 90]]);
    await h.sql.query(`update public.films set poster_source = 'tvdb', tvdb_id = 42`);

    assert.equal(await markUnmatchable(h.sql), 0);

    const { rows } = await h.sql.query<{ poster_source: string }>(
      'select poster_source from public.films',
    );
    assert.equal(rows[0]?.poster_source, 'tvdb');
  });

  it('reports the share that ended up with real artwork', async () => {
    const text = formatProgress({ processed: 4, matched: 3, generated: 1, failed: 0 });
    assert.match(text, /with art\s+3 \(75\.0 %\)/);
  });
});
