/**
 * M1 — reading Wikidata over its API instead of the full dump.
 *
 * The roadmap plans the catalog around `latest-all.json.bz2`, which is
 * around 100 GB and the right tool once the whole tail is wanted. For a
 * base catalog of the most relevant films it is a large detour: the same
 * films can be listed by SPARQL and fetched by id.
 *
 * The important part is what this module does NOT do. It never extracts
 * fields in SPARQL. SPARQL supplies ids, the entity API supplies entities
 * in exactly the shape the dump has, and extract.ts turns them into rows.
 * One extractor, one set of tests, one behaviour — a second code path
 * would drift from the first the moment either changed.
 */
import type { WikidataEntity } from './types.ts';

import subclasses from './film-subclasses.json' with { type: 'json' };

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const API_ENDPOINT = 'https://www.wikidata.org/w/api.php';

/** Wikidata asks for a descriptive agent with a way to make contact. */
const USER_AGENT =
  'BingeLog/0.1 (https://github.com/SunFlowerTechDE/BingeLog; catalog import)';

/** wbgetentities takes at most 50 ids per call for anonymous clients. */
const MAX_IDS_PER_REQUEST = 50;

/**
 * The 845 subclasses of film, spelled out.
 *
 * The obvious formulation is `?f wdt:P31/wdt:P279* wd:Q11424`, and it
 * does not work: measured against the live endpoint it answers 502 after
 * twelve seconds, because resolving the closure for every candidate is
 * more than the query service will spend. The closure is already a static
 * file (M1 1.1), so handing it over as VALUES turns a graph walk into a
 * lookup. The same slice then answers in about seven seconds.
 *
 * Even so this only carries the sparse top of the distribution. Below
 * roughly fifty sitelinks the bucket grows large enough that the join
 * times out again, which is the measurement behind the roadmap's rule
 * that bulk import goes through the dump and not through SPARQL.
 */
const FILM_CLASS_VALUES = subclasses.ids.map((id) => `wd:${id}`).join(' ');

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  /** Spacing between requests. Wikidata is a donated service. */
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

function createThrottle(options: FetchOptions) {
  const {
    minIntervalMs = 120,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = () => Date.now(),
  } = options;

  let last = 0;
  return async () => {
    const waited = now() - last;
    if (waited < minIntervalMs) await sleep(minIntervalMs - waited);
    last = now();
  };
}

/**
 * Statuses worth trying again. The query service answers a 502 or a 429
 * often enough over a few hundred requests that treating one as fatal
 * would mean no run ever finishes — a full pass hit exactly that on its
 * first attempt.
 */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

async function requestWithRetry(
  url: string,
  init: RequestInit,
  options: FetchOptions,
): Promise<Response> {
  const {
    fetchImpl = fetch,
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  let lastProblem = '';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetchImpl(url, init);
    } catch (error) {
      lastProblem = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (response.ok) return response;

    // A status that will not change by asking again belongs to the
    // caller, which knows what the request meant.
    if (!RETRYABLE_STATUS.has(response.status)) return response;

    lastProblem = `${String(response.status)} ${response.statusText}`;
    if (attempt === MAX_ATTEMPTS) break;

    // A service that says how long to wait knows better than the formula.
    const retryAfter = Number(response.headers.get('Retry-After'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt));
  }

  throw new Error(`request to ${url.slice(0, 80)} failed after ${String(MAX_ATTEMPTS)} attempts: ${lastProblem}`);
}

/** Exponential, with a little spread so parallel runs do not synchronise. */
function backoffMs(attempt: number): number {
  return 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

interface SparqlResponse {
  results?: { bindings?: Record<string, { value?: string }>[] };
}

/**
 * Runs one SPARQL query and returns the values of a single variable.
 *
 * Every caller here keeps its query small enough to finish well inside
 * the 60 second limit. A query that needs pagination gets paginated by
 * the caller rather than made bigger.
 */
export async function sparqlValues(
  query: string,
  variable: string,
  options: FetchOptions = {},
): Promise<string[]> {
  // POST rather than a query string: the class list below runs to about
  // 11 kB, well past what a URL can carry.
  const response = await requestWithRetry(
    SPARQL_ENDPOINT,
    {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/sparql-query',
        'User-Agent': USER_AGENT,
      },
      body: query,
    },
    options,
  );

  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${String(response.status)} ${response.statusText}`);
  }

  const body = (await response.json()) as SparqlResponse;
  return (body.results?.bindings ?? [])
    .map((row) => row[variable]?.value)
    .filter((value): value is string => value !== undefined)
    .map((value) => value.replace('http://www.wikidata.org/entity/', ''));
}

/**
 * Film ids at or above a sitelink threshold, most linked first.
 *
 * Sliced by sitelink count rather than paged by OFFSET. A deep OFFSET
 * makes the endpoint re-sort the whole result set for every page and is
 * what runs into the timeout; each slice here is a small, independent
 * query. Slicing by an exact count also makes the walk resumable: a slice
 * that fails can be repeated without disturbing the others.
 */
export async function collectFilmIds(
  minSitelinks: number,
  options: FetchOptions & { maxSitelinks?: number; onProgress?: (ids: number, at: number) => void } = {},
): Promise<string[]> {
  // Measured in August 2026: no film exceeds 150 language versions, and
  // only four reach 120. Starting at 400 would spend a few hundred
  // requests confirming that nothing is there. A future film above the
  // ceiling is not lost, it simply arrives through lazy creation like any
  // other film below the threshold.
  const { maxSitelinks = 160, onProgress } = options;
  const throttle = createThrottle(options);

  const ids: string[] = [];
  const seen = new Set<string>();

  for (let sitelinks = maxSitelinks; sitelinks >= minSitelinks; sitelinks--) {
    const query = `
      SELECT DISTINCT ?f WHERE {
        VALUES ?class { ${FILM_CLASS_VALUES} }
        ?f wdt:P31 ?class ;
           wikibase:sitelinks ${String(sitelinks)} .
      }`;

    await throttle();
    const slice = await sparqlValues(query, 'f', options);

    for (const id of slice) {
      if (/^Q\d+$/.test(id) && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }

    onProgress?.(ids.length, sitelinks);
  }

  return ids;
}

interface EntitiesResponse {
  entities?: Record<string, WikidataEntity & { missing?: string }>;
}

/**
 * Fetches entities by id, in the same JSON shape the dump delivers.
 *
 * Ids that no longer exist come back flagged as missing and are dropped
 * rather than surfaced as an error: a redirected or deleted item is a
 * normal thing to meet in a list assembled minutes earlier.
 */
export async function fetchEntities(
  ids: string[],
  options: FetchOptions = {},
): Promise<WikidataEntity[]> {
  const throttle = createThrottle(options);

  const out: WikidataEntity[] = [];

  for (let offset = 0; offset < ids.length; offset += MAX_IDS_PER_REQUEST) {
    const chunk = ids.slice(offset, offset + MAX_IDS_PER_REQUEST);

    const url =
      `${API_ENDPOINT}?action=wbgetentities&format=json&formatversion=2` +
      `&props=labels|claims|sitelinks&ids=${chunk.join('|')}`;

    await throttle();
    const response = await requestWithRetry(url, { headers: { 'User-Agent': USER_AGENT } }, options);

    if (!response.ok) {
      throw new Error(
        `wbgetentities failed for ${String(chunk.length)} id(s): ${String(response.status)} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as EntitiesResponse;

    for (const [id, entity] of Object.entries(body.entities ?? {})) {
      if (entity.missing !== undefined) continue;
      out.push({ ...entity, id: entity.id || id });
    }
  }

  return out;
}

/** Resolves a single film by IMDb id. Used by lazy creation (M1 1.5). */
export async function findFilmIdByImdbId(
  imdbId: string,
  options: FetchOptions = {},
): Promise<string | null> {
  if (!/^tt\d{7,}$/.test(imdbId)) return null;

  const query = `SELECT ?f WHERE { ?f wdt:P345 "${imdbId}" . } LIMIT 1`;
  const [id] = await sparqlValues(query, 'f', options);
  return id ?? null;
}

/**
 * Film ids whose title matches a search term. The fallback for a search
 * that found nothing locally (M1 1.5).
 *
 * Uses Wikidata's search index rather than SPARQL. A SPARQL label match
 * needs a FILTER over labels, which is a scan and times out; the search
 * index answers the same question in a fraction of a second and is what
 * it exists for. It also means no user input is ever spliced into a query
 * language.
 *
 * `haswbstatement:P31=Q11424` narrows to films without expanding the 845
 * subclasses into the query. That misses a documentary whose only class
 * is Q93204, so callers must still run candidates through extractFilm,
 * which checks the full closure and rejects anything that is not a film.
 */
export async function findFilmIdsByTitle(
  title: string,
  options: FetchOptions & { limit?: number } = {},
): Promise<string[]> {
  const { fetchImpl = fetch, limit = 5 } = options;

  const term = title.trim().slice(0, 120);
  if (term === '') return [];

  const url =
    `${API_ENDPOINT}?action=query&list=search&format=json&formatversion=2` +
    `&srlimit=${String(limit)}&srprop=&srsearch=${encodeURIComponent(`${term} haswbstatement:P31=Q11424`)}`;

  const response = await requestWithRetry(url, { headers: { 'User-Agent': USER_AGENT } }, {
    ...options,
    fetchImpl,
  });

  if (!response.ok) return [];

  const body = (await response.json()) as { query?: { search?: { title?: string }[] } };

  return (body.query?.search ?? [])
    .map((hit) => hit.title)
    .filter((id): id is string => id !== undefined && /^Q\d+$/.test(id));
}
