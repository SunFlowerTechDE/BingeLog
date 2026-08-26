/**
 * M1 — building the base catalog.
 *
 * Lists the most relevant films by sitelink count, fetches them by id and
 * runs them through the same extractor the dump path uses. Everything
 * below that threshold arrives later through lazy creation, driven by
 * what people actually search for rather than by stockpiling.
 *
 * Order matters and is not negotiable: films, then the people and genres
 * they reference, then the links between them. Credits carry foreign keys
 * to all three.
 */
import type { Client } from 'pg';

import { collectFilmIds, fetchEntities, type FetchOptions } from './api.ts';
import { extractFilm, extractNamedEntity } from './extract.ts';
import {
  countFilm,
  createStagingTables,
  emptyStats,
  loadCredits,
  loadFilmGenres,
  loadFilms,
  loadGenres,
  loadPeople,
  type ImportStats,
} from './load.ts';
import type { ExtractedCredit, ExtractedGenre } from './types.ts';

export interface SeedOptions extends FetchOptions {
  /** Films with at least this many Wikipedia language versions (ADR-008). */
  minSitelinks?: number;
  /** Entities fetched and loaded per round. */
  batchSize?: number;
  /** Stop after this many films. For a quick run during development. */
  limit?: number;
  onProgress?: (message: string) => void;
}

export interface SeedResult extends ImportStats {
  people: number;
  genres: number;
  credits: number;
  genreLinks: number;
}

/** Default reporter: a run without a listener says nothing. */
function ignoreProgress(): void {
  // intentionally silent
}

export async function seedCatalog(db: Client, options: SeedOptions = {}): Promise<SeedResult> {
  const { minSitelinks = 10, batchSize = 500, limit, onProgress = ignoreProgress } = options;

  await createStagingTables(db);

  onProgress(`collecting film ids with at least ${String(minSitelinks)} sitelinks`);
  const allIds = await collectFilmIds(minSitelinks, {
    ...options,
    onProgress: (count, at) => {
      onProgress(`  ${String(count)} ids, down to ${String(at)} sitelinks`);
    },
  });

  const ids = limit === undefined ? allIds : allIds.slice(0, limit);
  onProgress(`${String(ids.length)} film(s) to import`);

  const stats = emptyStats();
  const credits: ExtractedCredit[] = [];
  const genreLinks: ExtractedGenre[] = [];
  const referenced = new Set<string>();

  for (let offset = 0; offset < ids.length; offset += batchSize) {
    const chunk = ids.slice(offset, offset + batchSize);
    const entities = await fetchEntities(chunk, options);

    const extracted = entities
      .map((entity) => extractFilm(entity))
      .filter((result) => result !== null);

    for (const result of extracted) {
      countFilm(stats, result.film);
      credits.push(...result.credits);
      genreLinks.push(...result.genres);
      for (const credit of result.credits) referenced.add(credit.personId);
      for (const genre of result.genres) referenced.add(genre.genreId);
    }

    stats.filmsLoaded += await loadFilms(
      db,
      extracted.map((result) => result.film),
    );

    onProgress(`  ${String(Math.min(offset + batchSize, ids.length))}/${String(ids.length)} films`);
  }

  // People and genres are only known once every film has been seen, which
  // is why they cannot be loaded in the same pass.
  onProgress(`resolving ${String(referenced.size)} referenced entities`);

  const genreIds = new Set(genreLinks.map((link) => link.genreId));
  let people = 0;
  let genres = 0;

  const referencedIds = [...referenced];
  for (let offset = 0; offset < referencedIds.length; offset += batchSize) {
    const chunk = referencedIds.slice(offset, offset + batchSize);
    const entities = await fetchEntities(chunk, options);

    const named = entities
      .map((entity) => extractNamedEntity(entity))
      .filter((result) => result !== null);

    people += await loadPeople(
      db,
      named
        .filter((entity) => !genreIds.has(entity.wikidataId))
        .map((entity) => ({
          wikidataId: entity.wikidataId,
          name: entity.name,
          sitelinkCount: entity.sitelinkCount,
        })),
    );

    genres += await loadGenres(
      db,
      named
        .filter((entity) => genreIds.has(entity.wikidataId))
        .map((entity) => ({
          wikidataId: entity.wikidataId,
          labelDe: entity.nameDe,
          labelEn: entity.nameEn,
        })),
    );

    onProgress(
      `  ${String(Math.min(offset + batchSize, referencedIds.length))}/${String(referencedIds.length)} entities`,
    );
  }

  onProgress('linking credits and genres');
  const loadedCredits = await loadCredits(db, credits);
  const loadedGenreLinks = await loadFilmGenres(db, genreLinks);

  return {
    ...stats,
    people,
    genres,
    credits: loadedCredits,
    genreLinks: loadedGenreLinks,
  };
}
