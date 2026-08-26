/**
 * M1 1.2 — Turning a Wikidata entity into catalog rows.
 *
 * Everything here is a pure function over one entity. That is deliberate:
 * the import runs over a 100 GB dump exactly once in a while, and the
 * only way to have confidence in it beforehand is to test the extraction
 * against real entities without a dump in sight.
 *
 * All metadata comes from here (ADR-001). Nothing in this file may ever
 * consult TheTVDB (ADR-002).
 */
import type {
  Claim,
  EntityIdValue,
  ExtractedCredit,
  ExtractedEntity,
  ExtractedFilm,
  ExtractedGenre,
  MonolingualText,
  QuantityValue,
  TimeValue,
  WikidataEntity,
} from './types.ts';

import subclasses from './film-subclasses.json' with { type: 'json' };

/** Subclass closure of Q11424, pulled once by scripts/fetch-film-subclasses.mjs. */
export const FILM_CLASSES: ReadonlySet<string> = new Set(subclasses.ids);

const PROPERTY = {
  instanceOf: 'P31',
  title: 'P1476',
  releaseDate: 'P577',
  runtime: 'P2047',
  director: 'P57',
  writer: 'P58',
  cast: 'P161',
  genre: 'P136',
  imdbId: 'P345',
  originalLanguage: 'P364',
} as const;

/** P2047 carries units. Anything else is discarded rather than guessed. */
const RUNTIME_UNIT_TO_MINUTES: Readonly<Record<string, number>> = {
  Q7727: 1, // minute
  Q11574: 1 / 60, // second
  Q25235: 60, // hour
};

const IMDB_TITLE_PATTERN = /^tt\d{7,}$/;

// ---------------------------------------------------------------------------
// Claim helpers
// ---------------------------------------------------------------------------

/**
 * Claims that carry a usable value, deprecated ones dropped, preferred
 * ones first. Wikidata uses deprecated rank to mark statements known to
 * be wrong, so keeping them would import errors on purpose.
 */
function usableClaims(entity: WikidataEntity, property: string): Claim[] {
  const claims = entity.claims?.[property] ?? [];
  const usable = claims.filter(
    (claim) => claim.rank !== 'deprecated' && claim.mainsnak.snaktype === 'value',
  );
  return [
    ...usable.filter((claim) => claim.rank === 'preferred'),
    ...usable.filter((claim) => claim.rank !== 'preferred'),
  ];
}

function claimValues<T>(entity: WikidataEntity, property: string): T[] {
  return usableClaims(entity, property)
    .map((claim) => claim.mainsnak.datavalue?.value)
    .filter((value): value is NonNullable<typeof value> => value !== undefined) as T[];
}

function entityIds(entity: WikidataEntity, property: string): string[] {
  return claimValues<EntityIdValue>(entity, property)
    .map((value) => value.id)
    .filter((id) => typeof id === 'string');
}

// ---------------------------------------------------------------------------
// Field extraction
// ---------------------------------------------------------------------------

/** True when the entity is a film or any subclass of one (M1 1.1). */
export function isFilm(entity: WikidataEntity): boolean {
  return entityIds(entity, PROPERTY.instanceOf).some((id) => FILM_CLASSES.has(id));
}

function label(entity: WikidataEntity, language: string): string | null {
  const value = entity.labels?.[language]?.value.trim();
  // An empty label is as good as no label, but it is not nullish, so the
  // check has to be explicit rather than a ?? away.
  return value === undefined || value.length === 0 ? null : value;
}

/**
 * The original title.
 *
 * P1476 is the authority. Where it is missing, fall back to the label in
 * the work's original language, then to English, then to German, then to
 * whatever label exists. The column is NOT NULL and a film without any
 * title at all is not importable, so the caller drops it.
 *
 * This ladder is a fallback for a missing property, not for a missing
 * translation. Note the contrast with titleDe below.
 */
function originalTitle(entity: WikidataEntity): string | null {
  const stated = claimValues<MonolingualText>(entity, PROPERTY.title)[0];
  if (stated?.text.trim()) return stated.text.trim();

  const originalLanguages = entityIds(entity, PROPERTY.originalLanguage);
  for (const languageItem of originalLanguages) {
    const code = LANGUAGE_ITEM_TO_CODE[languageItem];
    if (code) {
      const fromLabel = label(entity, code);
      if (fromLabel) return fromLabel;
    }
  }

  const firstLabel = Object.values(entity.labels ?? {})[0]?.value.trim();
  const anyLabel = firstLabel === undefined || firstLabel.length === 0 ? null : firstLabel;
  return label(entity, 'en') ?? label(entity, 'de') ?? anyLabel;
}

/**
 * A handful of language items, enough to resolve the common cases for
 * P364. An unknown item simply falls through to the next rung of the
 * ladder rather than guessing.
 */
const LANGUAGE_ITEM_TO_CODE: Readonly<Record<string, string>> = {
  Q1860: 'en',
  Q188: 'de',
  Q150: 'fr',
  Q1321: 'es',
  Q652: 'it',
  Q7737: 'ru',
  Q5287: 'ja',
  Q9176: 'ko',
  Q9192: 'zh',
  Q5146: 'pt',
  Q9027: 'sv',
  Q9035: 'da',
  Q9043: 'no',
  Q1412: 'fi',
  Q7411: 'nl',
  Q809: 'pl',
  Q9072: 'cs',
  Q256: 'tr',
  Q13955: 'ar',
  Q1568: 'hi',
};

/**
 * The earliest release date, as a year.
 *
 * P577 repeats: festival premiere, then a cinema release per country
 * (M1 1.2). Taking the first entry in the array would be arbitrary, so
 * take the earliest actual date. Values coarser than year precision
 * carry no year worth storing and are dropped.
 */
function releaseYear(entity: WikidataEntity): number | null {
  const years = claimValues<TimeValue>(entity, PROPERTY.releaseDate)
    .filter((value) => value.precision >= 9)
    .map((value) => {
      // '+1972-02-05T00:00:00Z' and '-0044-03-15T00:00:00Z' both parse here.
      const match = /^([+-])(\d{4,})-/.exec(value.time);
      if (!match) return null;
      const year = Number(match[2]);
      return match[1] === '-' ? -year : year;
    })
    .filter((year): year is number => year !== null && Number.isFinite(year));

  if (years.length === 0) return null;
  return Math.min(...years);
}

/** Runtime in whole minutes. Units are checked, never assumed (M1 1.2). */
function runtimeMinutes(entity: WikidataEntity): number | null {
  for (const value of claimValues<QuantityValue>(entity, PROPERTY.runtime)) {
    const unitId = value.unit.replace('http://www.wikidata.org/entity/', '');
    const factor = RUNTIME_UNIT_TO_MINUTES[unitId];
    if (factor === undefined) continue;

    const amount = Number(value.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const minutes = Math.round(amount * factor);
    if (minutes > 0) return minutes;
  }
  return null;
}

function imdbId(entity: WikidataEntity): string | null {
  for (const value of claimValues<string>(entity, PROPERTY.imdbId)) {
    if (typeof value === 'string' && IMDB_TITLE_PATTERN.test(value)) return value;
  }
  return null;
}

function credits(entity: WikidataEntity): ExtractedCredit[] {
  const roles = [
    { property: PROPERTY.director, role: 'director' },
    { property: PROPERTY.cast, role: 'cast' },
    { property: PROPERTY.writer, role: 'writer' },
  ] as const;

  const out: ExtractedCredit[] = [];
  for (const { property, role } of roles) {
    const seen = new Set<string>();
    let ord = 0;
    for (const personId of entityIds(entity, property)) {
      // The primary key is (film, person, role), so a person credited
      // twice in the same role would collide on insert.
      if (seen.has(personId)) continue;
      seen.add(personId);
      out.push({ filmId: entity.id, personId, role, ord: ord++ });
    }
  }
  return out;
}

function genres(entity: WikidataEntity): ExtractedGenre[] {
  const seen = new Set<string>();
  const out: ExtractedGenre[] = [];
  for (const genreId of entityIds(entity, PROPERTY.genre)) {
    if (seen.has(genreId)) continue;
    seen.add(genreId);
    out.push({ filmId: entity.id, genreId });
  }
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Extracts one film. Returns null when the entity is not a film, or when
 * it has no title at all and therefore cannot satisfy the schema.
 */
export function extractFilm(entity: WikidataEntity): ExtractedEntity | null {
  if (!isFilm(entity)) return null;

  const titleOriginal = originalTitle(entity);
  if (!titleOriginal) return null;

  const film: ExtractedFilm = {
    wikidataId: entity.id,
    imdbId: imdbId(entity),
    titleOriginal,
    // No German label means no German title. Filling it with the English
    // one would bake a fallback into the data; the fallback belongs in
    // the query (M1 1.2).
    titleDe: label(entity, 'de'),
    titleEn: label(entity, 'en'),
    releaseYear: releaseYear(entity),
    runtimeMin: runtimeMinutes(entity),
    // Relevance signal for search ranking and batch priority (ADR-008).
    sitelinkCount: Object.keys(entity.sitelinks ?? {}).length,
  };

  return { film, credits: credits(entity), genres: genres(entity) };
}

/** Person and genre ids a film points at, for the dump's second pass. */
export function referencedEntityIds(extracted: ExtractedEntity): {
  people: string[];
  genres: string[];
} {
  return {
    people: extracted.credits.map((credit) => credit.personId),
    genres: extracted.genres.map((genre) => genre.genreId),
  };
}

/** Label and sitelink count for a referenced person or genre entity. */
export function extractNamedEntity(entity: WikidataEntity): {
  wikidataId: string;
  nameDe: string | null;
  nameEn: string | null;
  name: string;
  sitelinkCount: number;
} | null {
  const name =
    label(entity, 'en') ??
    label(entity, 'de') ??
    Object.values(entity.labels ?? {})[0]?.value.trim() ??
    null;
  if (!name) return null;

  return {
    wikidataId: entity.id,
    nameDe: label(entity, 'de'),
    nameEn: label(entity, 'en'),
    name,
    sitelinkCount: Object.keys(entity.sitelinks ?? {}).length,
  };
}
