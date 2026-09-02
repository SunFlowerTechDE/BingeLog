/**
 * M1 — reading Wikidata over its API.
 *
 * Tested against an injected fetch. The point of these assertions is the
 * request shape: which endpoint, how many ids at a time, and above all
 * that no field is ever read out of a SPARQL result. SPARQL supplies
 * ids, the entity API supplies entities, extract.ts does the rest.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectFilmIds,
  fetchEntities,
  findFilmIdByImdbId,
  findFilmIdsByTitle,
  sparqlValues,
} from '../src/wikidata/api.ts';

// Kein Warten in Tests: die Backoff-Zeiten sind real und wuerden die
// Suite um Minuten verlaengern, ohne etwas zu belegen.
const NO_WAIT = { minIntervalMs: 0, sleep: async (): Promise<void> => undefined };

/**
 * SPARQL travels in the POST body now, the search API in the URL, so the
 * stub records both and hands the handler whichever carries the query.
 */
function stub(handler: (request: string) => unknown) {
  const calls: string[] = [];
  const urls: string[] = [];

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    const sent = typeof init?.body === 'string' ? init.body : href;
    urls.push(href);
    calls.push(sent);

    const body = handler(sent);
    if (body === undefined) return new Response('boom', { status: 500, statusText: 'Error' });
    return Response.json(body);
  }) as unknown as typeof fetch;

  return { fetchImpl, calls, urls };
}

function sparqlResult(ids: string[]) {
  return {
    results: {
      bindings: ids.map((id) => ({ f: { value: `http://www.wikidata.org/entity/${id}` } })),
    },
  };
}

describe('SPARQL access', () => {
  it('strips the entity prefix from returned ids', async () => {
    const s = stub(() => sparqlResult(['Q125772', 'Q156911']));
    const values = await sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl: s.fetchImpl });
    assert.deepEqual(values, ['Q125772', 'Q156911']);
  });

  it('sends a descriptive user agent', async () => {
    let seen: Headers | undefined;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      seen = new Headers(init?.headers);
      return Response.json(sparqlResult([]));
    }) as unknown as typeof fetch;

    await sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl });
    assert.match(seen?.get('User-Agent') ?? '', /BingeLog/);
  });

  it('reports a failed query rather than returning nothing', async () => {
    const s = stub(() => undefined);
    await assert.rejects(() =>
      sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl: s.fetchImpl, ...NO_WAIT }),
    );
  });
});

describe('surviving a flaky endpoint', () => {
  function flaky(failures: number, status = 502) {
    let seen = 0;
    const fetchImpl = (async () => {
      seen++;
      if (seen <= failures) {
        return new Response('bad gateway', { status, statusText: 'Bad Gateway' });
      }
      return Response.json(sparqlResult(['Q1']));
    }) as unknown as typeof fetch;
    return { fetchImpl, attempts: () => seen };
  }

  it('retries a 502 and succeeds', async () => {
    // The query service really does answer 502 now and then; a full pass
    // hit one on its first attempt. Treating it as fatal would mean no
    // run ever finishes.
    const f = flaky(2);
    const values = await sparqlValues('SELECT ?f WHERE {}', 'f', {
      fetchImpl: f.fetchImpl,
      ...NO_WAIT,
    });

    assert.deepEqual(values, ['Q1']);
    assert.equal(f.attempts(), 3);
  });

  it('retries a 429 as well', async () => {
    const f = flaky(1, 429);
    await sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl: f.fetchImpl, ...NO_WAIT });
    assert.equal(f.attempts(), 2);
  });

  it('gives up rather than hammering forever', async () => {
    const f = flaky(99);
    await assert.rejects(
      () => sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl: f.fetchImpl, ...NO_WAIT }),
      /after 5 attempts/,
    );
    assert.equal(f.attempts(), 5);
  });

  it('does not retry a query that is simply wrong', async () => {
    let seen = 0;
    const fetchImpl = (async () => {
      seen++;
      return new Response('malformed query', { status: 400, statusText: 'Bad Request' });
    }) as unknown as typeof fetch;

    await assert.rejects(() => sparqlValues('SELECT nonsense', 'f', { fetchImpl, ...NO_WAIT }));
    assert.equal(seen, 1, 'a 400 will not become a 200 by asking again');
  });

  it('honours Retry-After when the service states one', async () => {
    const waits: number[] = [];
    let seen = 0;
    const fetchImpl = (async () => {
      seen++;
      if (seen === 1) {
        return new Response('slow down', {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '2' },
        });
      }
      return Response.json(sparqlResult(['Q1']));
    }) as unknown as typeof fetch;

    await sparqlValues('SELECT ?f WHERE {}', 'f', {
      fetchImpl,
      minIntervalMs: 0,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    assert.ok(waits.includes(2000), `expected a 2 s wait, got ${JSON.stringify(waits)}`);
  });

  it('retries a network error too', async () => {
    let seen = 0;
    const fetchImpl = (async () => {
      seen++;
      if (seen === 1) throw new Error('ECONNRESET');
      return Response.json(sparqlResult(['Q1']));
    }) as unknown as typeof fetch;

    const values = await sparqlValues('SELECT ?f WHERE {}', 'f', { fetchImpl, ...NO_WAIT });
    assert.deepEqual(values, ['Q1']);
    assert.equal(seen, 2);
  });
});

describe('collecting film ids', () => {
  it('walks one sitelink count at a time, highest first', async () => {
    const s = stub((query) => {
      const sitelinks = Number(/wikibase:sitelinks (\d+)/.exec(query)?.[1]);
      return sparqlResult(sitelinks >= 8 ? [`Q${String(sitelinks)}`] : []);
    });

    const ids = await collectFilmIds(8, { fetchImpl: s.fetchImpl, maxSitelinks: 10, ...NO_WAIT });

    // Slices, not OFFSET pages: a deep offset makes the endpoint re-sort
    // everything for each page, which is what runs into the timeout.
    assert.deepEqual(ids, ['Q10', 'Q9', 'Q8']);
    assert.equal(s.calls.length, 3);
    for (const call of s.calls) assert.ok(!call.includes('OFFSET'));
  });

  it('never returns the same film twice', async () => {
    const s = stub(() => sparqlResult(['Q1', 'Q1', 'Q2']));
    const ids = await collectFilmIds(9, { fetchImpl: s.fetchImpl, maxSitelinks: 10, ...NO_WAIT });
    assert.deepEqual(ids, ['Q1', 'Q2']);
  });

  it('includes subclasses of film, not only direct instances', async () => {
    const s = stub(() => sparqlResult([]));
    await collectFilmIds(10, { fetchImpl: s.fetchImpl, maxSitelinks: 10, ...NO_WAIT });

    // Filtering on wdt:P31 wd:Q11424 alone was the measurement query, not
    // the import filter; documentaries would be missing (M1 Fallstricke).
    // The closure is handed over as VALUES rather than walked with
    // wdt:P279*, which the live endpoint answers with a 502.
    const query = s.calls[0] ?? '';
    assert.match(query, /VALUES \?class \{ wd:Q11424 /);
    assert.ok(!query.includes('P279'), 'no property path');
    assert.ok(query.includes('wd:Q93204'), 'documentary film must be in the class list');
  });
});

describe('fetching entities', () => {
  function entitiesResult(ids: string[]) {
    return {
      entities: Object.fromEntries(
        ids.map((id) => [id, { id, type: 'item', labels: {}, claims: {}, sitelinks: {} }]),
      ),
    };
  }

  it('asks for at most 50 ids per request', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `Q${String(i + 1)}`);
    const s = stub((url) => {
      const requested = decodeURIComponent(/ids=([^&]+)/.exec(url)?.[1] ?? '').split('|');
      assert.ok(requested.length <= 50, `asked for ${String(requested.length)} ids`);
      return entitiesResult(requested);
    });

    const entities = await fetchEntities(ids, { fetchImpl: s.fetchImpl, ...NO_WAIT });

    assert.equal(entities.length, 120);
    assert.equal(s.calls.length, 3);
  });

  it('asks for the props the extractor reads', async () => {
    const s = stub(() => entitiesResult(['Q1']));
    await fetchEntities(['Q1'], { fetchImpl: s.fetchImpl, ...NO_WAIT });

    const call = decodeURIComponent(s.calls[0] ?? '');
    assert.match(call, /action=wbgetentities/);
    for (const prop of ['labels', 'claims', 'sitelinks']) {
      assert.ok(call.includes(prop), `missing prop: ${prop}`);
    }
  });

  it('drops an id that no longer exists instead of failing', async () => {
    const s = stub(() => ({
      entities: {
        Q1: { id: 'Q1', type: 'item', labels: {}, claims: {}, sitelinks: {} },
        Q2: { id: 'Q2', missing: '' },
      },
    }));

    const entities = await fetchEntities(['Q1', 'Q2'], { fetchImpl: s.fetchImpl, ...NO_WAIT });

    assert.deepEqual(
      entities.map((e) => e.id),
      ['Q1'],
    );
  });
});

describe('lazy creation lookups', () => {
  it('resolves a film by IMDb id', async () => {
    const s = stub(() => sparqlResult(['Q125772']));
    const id = await findFilmIdByImdbId('tt0069293', { fetchImpl: s.fetchImpl });
    assert.equal(id, 'Q125772');
    assert.match(s.calls[0] ?? '', /wdt:P345 "tt0069293"/);
  });

  it('refuses an id that is not an IMDb title id, without a request', async () => {
    const s = stub(() => sparqlResult([]));
    assert.equal(await findFilmIdByImdbId('nm0000040', { fetchImpl: s.fetchImpl }), null);
    assert.deepEqual(s.calls, []);
  });

  it('finds candidates for a title through the search index', async () => {
    const s = stub(() => ({
      query: { search: [{ title: 'Q125772' }, { title: 'Q673195' }] },
    }));

    const ids = await findFilmIdsByTitle('Solaris', { fetchImpl: s.fetchImpl, ...NO_WAIT });

    assert.deepEqual(ids, ['Q125772', 'Q673195']);
    assert.match(s.urls[0] ?? '', /list=search/);
  });

  it('does not splice user input into a query language', async () => {
    const s = stub(() => ({ query: { search: [] } }));
    await findFilmIdsByTitle('Solaris" } UNION { ?f ?p ?o', { fetchImpl: s.fetchImpl, ...NO_WAIT });

    const call = s.urls[0] ?? '';
    // The term travels as a percent-encoded search parameter. It cannot
    // close a literal or graft a clause, because it never reaches a query
    // language in the first place.
    assert.match(call, /list=search/);
    assert.ok(!call.includes('"'), 'the quote must arrive encoded');
    assert.ok(!call.includes('?f ?p ?o'), 'no raw triple pattern in the request');
  });

  it('asks for more candidates than it keeps, and stays capped', async () => {
    // Gesucht wird ohne den Filter auf `P31=Q11424`, weil der
    // Animationsfilme und Fernsehfilme ausschloss. Dafuer sind unter
    // den rohen Treffern auch Nicht-Filme, die `extractFilm` erst
    // aussortiert — also werden mehr geholt, als gebraucht werden.
    const s = stub(() => ({ query: { search: [] } }));
    await findFilmIdsByTitle('Solaris', { fetchImpl: s.fetchImpl, limit: 3, ...NO_WAIT });
    assert.match(s.urls[0] ?? '', /srlimit=6/);

    // Und nie ohne Grenze: fuenfzig ist Schluss.
    const gross = stub(() => ({ query: { search: [] } }));
    await findFilmIdsByTitle('Solaris', { fetchImpl: gross.fetchImpl, limit: 400, ...NO_WAIT });
    assert.match(gross.urls[0] ?? '', /srlimit=50/);
  });

  it('does not narrow the search to P31=Q11424', () => {
    // Der Filter liess nur Entitaeten durch, deren `P31` genau "Film"
    // ist. "Finding Nemo" ist Q202866, "High School Musical" ein
    // Fernsehfilm — beide waren damit unauffindbar, obwohl sie seit
    // Jahren bei Wikidata stehen. Was ein Film ist, entscheidet
    // `extractFilm` ueber die ganze Unterklassenhuelle.
    const s = stub(() => ({ query: { search: [] } }));
    return findFilmIdsByTitle('Finding Nemo', { fetchImpl: s.fetchImpl, ...NO_WAIT }).then(() => {
      assert.ok(!(s.urls[0] ?? '').includes('haswbstatement'), 'kein Filter auf eine Klasse');
    });
  });

  it('returns nothing for an empty term, without a request', async () => {
    const s = stub(() => ({ query: { search: [] } }));
    assert.deepEqual(await findFilmIdsByTitle('   ', { fetchImpl: s.fetchImpl, ...NO_WAIT }), []);
    assert.deepEqual(s.calls, []);
  });
});
