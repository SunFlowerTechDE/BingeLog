/**
 * M2 2.2 — TheTVDB v4 client.
 *
 * This module can look a film up by IMDb id and by nothing else. That is
 * not an oversight, it is ADR-003: TheTVDB's title search ranks by title
 * similarity rather than relevance, and its documented failures are the
 * kind nobody notices — a documentary about the film instead of the film,
 * a different cut, a series with a similar name. A missing link is
 * visible and harmless; a wrong one is a silent error. So there is no
 * title search here to reach for in a weak moment.
 *
 * The client returns artwork and nothing else. Titles, runtimes and
 * synopses come from Wikidata (ADR-002) — TheTVDB calls Q125772
 * "Солярис" with a runtime of 167 minutes where Wikidata says 160.
 */

export interface TvdbMatch {
  tvdbId: number;
  /** Absolute URL on artworks.thetvdb.com, or null when none is offered. */
  posterUrl: string | null;
}

export interface TvdbClientOptions {
  apiKey: string;
  /** Only user-supported keys carry one. A negotiated contract has none. */
  pin?: string | undefined;
  /** Minimum spacing between requests. Politeness, not a documented limit. */
  minIntervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const BASE_URL = 'https://api4.thetvdb.com/v4';

interface LoginResponse {
  data?: { token?: string };
}

interface RemoteIdResponse {
  data?: { movie?: { id?: number; image?: string | null } }[];
}

export interface TvdbClient {
  /** The only lookup there is. Returns null when the id is unknown. */
  findByImdbId: (imdbId: string) => Promise<TvdbMatch | null>;
  /** Requests made so far, for progress reporting. */
  requestCount: () => number;
}

export function createTvdbClient(options: TvdbClientOptions): TvdbClient {
  const {
    apiKey,
    pin,
    minIntervalMs = 220,
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = options;

  let token: string | null = null;
  let lastRequestAt = 0;
  let requests = 0;

  async function login(): Promise<string> {
    const response = await fetchImpl(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(pin ? { apikey: apiKey, pin } : { apikey: apiKey }),
    });

    if (!response.ok) {
      throw new Error(`TheTVDB login failed: ${String(response.status)} ${response.statusText}`);
    }

    const body = (await response.json()) as LoginResponse;
    const fresh = body.data?.token;
    if (!fresh) throw new Error('TheTVDB login returned no token');

    token = fresh;
    return fresh;
  }

  async function throttle(): Promise<void> {
    const waited = now() - lastRequestAt;
    if (waited < minIntervalMs) await sleep(minIntervalMs - waited);
    lastRequestAt = now();
  }

  /**
   * The token is a JWT with roughly a month of life. Rather than tracking
   * its expiry, treat a 401 as the signal and log in again — that also
   * covers a token revoked early. One retry, so a genuinely rejected key
   * fails loudly instead of looping.
   */
  async function authorizedGet(path: string): Promise<Response> {
    token ??= await login();

    await throttle();
    requests++;
    let response = await fetchImpl(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });

    if (response.status === 401) {
      token = await login();
      await throttle();
      requests++;
      response = await fetchImpl(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
    }

    return response;
  }

  return {
    requestCount: () => requests,

    async findByImdbId(imdbId: string): Promise<TvdbMatch | null> {
      if (!/^tt\d{7,}$/.test(imdbId)) {
        throw new Error(`not an IMDb title id: ${imdbId}`);
      }

      const response = await authorizedGet(`/search/remoteid/${imdbId}`);

      // An unknown id is a normal outcome, not a failure. It means a
      // procedural card (ADR-004), which is a complete answer.
      if (response.status === 404) return null;

      if (!response.ok) {
        throw new Error(
          `TheTVDB lookup for ${imdbId} failed: ${String(response.status)} ${response.statusText}`,
        );
      }

      const body = (await response.json()) as RemoteIdResponse;

      // Only movie records count. A film's IMDb id resolving to a series
      // record means the two databases disagree about what this is, and
      // taking it anyway would be exactly the silent mislink ADR-003
      // exists to prevent.
      const movie = body.data?.find((entry) => entry.movie?.id !== undefined)?.movie;
      if (!movie?.id) return null;

      return {
        tvdbId: movie.id,
        posterUrl: movie.image ?? null,
      };
    },
  };
}
