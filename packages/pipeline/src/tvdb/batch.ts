/**
 * M2 2.2 — the artwork batch.
 *
 * Walks the catalog in relevance order, asks TheTVDB for each film's
 * artwork by IMDb id, and records the answer. Runs offline in the
 * pipeline, never in a deployment.
 *
 * Resumable by construction: the job only ever selects films whose
 * poster_source is still null, and every processed film gets a value —
 * 'tvdb' on a hit, 'generated' on a miss. Aborting and restarting costs
 * the current batch and nothing else.
 *
 * Poster URLs point at artworks.thetvdb.com. Images are linked, never
 * mirrored: the terms forbid redistributing the data, and linking also
 * removes the question of what to delete if the licence ends. See
 * docs/legal/thetvdb-lizenz.md.
 */
import type { Client } from 'pg';

import type { TvdbClient } from './client.ts';

export interface BatchOptions {
  /** Films fetched from the database per round. */
  batchSize?: number;
  /** Stop after this many films. Omit to run to completion. */
  limit?: number;
  onProgress?: (progress: BatchProgress) => void;
}

export interface BatchProgress {
  processed: number;
  matched: number;
  generated: number;
  failed: number;
}

interface FilmRow {
  wikidata_id: string;
  imdb_id: string;
}

/**
 * Relevance order, so the films people actually search for get their
 * artwork first and an interrupted run still leaves the catalog in a
 * useful state (ADR-008).
 */
const SELECT_PENDING = `
  select wikidata_id, imdb_id
  from public.films
  where imdb_id is not null
    and poster_source is null
  order by sitelink_count desc, wikidata_id
  limit $1
`;

export async function runArtworkBatch(
  db: Client,
  tvdb: TvdbClient,
  options: BatchOptions = {},
): Promise<BatchProgress> {
  const { batchSize = 200, limit, onProgress } = options;

  const progress: BatchProgress = { processed: 0, matched: 0, generated: 0, failed: 0 };

  for (;;) {
    const remaining = limit === undefined ? batchSize : Math.min(batchSize, limit - progress.processed);
    if (remaining <= 0) break;

    const { rows } = await db.query<FilmRow>(SELECT_PENDING, [remaining]);
    if (rows.length === 0) break;

    for (const film of rows) {
      try {
        const match = await tvdb.findByImdbId(film.imdb_id);

        if (match) {
          await db.query(
            `update public.films
             set tvdb_id = $2, poster_url = $3, poster_source = 'tvdb'
             where wikidata_id = $1`,
            [film.wikidata_id, match.tvdbId, match.posterUrl],
          );
          progress.matched++;
        } else {
          // No match means a procedural card, full stop. There is no
          // second attempt by title (ADR-003).
          await db.query(
            `update public.films
             set poster_source = 'generated'
             where wikidata_id = $1`,
            [film.wikidata_id],
          );
          progress.generated++;
        }
      } catch (error) {
        // A transport error is not an answer. Leave poster_source null so
        // the next run picks the film up again rather than writing a
        // 'generated' the film never earned.
        progress.failed++;
        console.error(`  ${film.wikidata_id} (${film.imdb_id}): ${String(error)}`);
      }

      progress.processed++;
      if (progress.processed % 25 === 0) onProgress?.({ ...progress });
    }

    // A round that only produced failures would otherwise spin forever on
    // the same rows, since nothing was written.
    if (progress.failed === progress.processed) break;
  }

  onProgress?.({ ...progress });
  return progress;
}

/**
 * A film without an IMDb id can never be matched: the id is the only
 * bridge to TheTVDB and there is no fallback (ADR-003). Waiting for it to
 * acquire one leaves it without a decision, and M2's Definition of Done
 * asks for no film to be left undecided. So it gets its procedural card
 * straight away, which is a complete answer and not a placeholder
 * (ADR-004).
 *
 * A later Wikidata import that supplies an IMDb id does not undo this:
 * the loader never touches poster columns, so such a film stays on its
 * generated card until someone deliberately clears the column.
 */
export async function markUnmatchable(db: Client): Promise<number> {
  const { rowCount } = await db.query(
    `update public.films
     set poster_source = 'generated'
     where imdb_id is null and poster_source is null`,
  );
  return rowCount ?? 0;
}

export function formatProgress(progress: BatchProgress): string {
  const share = (n: number) =>
    progress.processed === 0 ? '0.0' : ((n / progress.processed) * 100).toFixed(1);

  return [
    `processed  ${String(progress.processed)}`,
    `with art   ${String(progress.matched)} (${share(progress.matched)} %)`,
    `generated  ${String(progress.generated)} (${share(progress.generated)} %)`,
    `failed     ${String(progress.failed)}`,
  ].join('\n');
}
