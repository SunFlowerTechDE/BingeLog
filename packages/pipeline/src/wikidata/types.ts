/**
 * The subset of the Wikidata entity JSON that the import touches.
 *
 * The shape is the same in the dump and in Special:EntityData, so the
 * fixtures under tests/fixtures are exactly what the importer sees.
 */

export interface MonolingualText {
  text: string;
  language: string;
}

export interface TimeValue {
  time: string; // '+1972-02-05T00:00:00Z'
  /** 11 = day, 10 = month, 9 = year, 8 = decade, and coarser below that. */
  precision: number;
}

export interface QuantityValue {
  amount: string; // '+160'
  unit: string; // 'http://www.wikidata.org/entity/Q7727' or '1' for unitless
}

export interface EntityIdValue {
  id: string; // 'Q853'
}

export type SnakValue = MonolingualText | TimeValue | QuantityValue | EntityIdValue | string;

export interface Snak {
  snaktype: 'value' | 'somevalue' | 'novalue';
  property: string;
  datavalue?: { value: SnakValue; type: string };
}

export interface Claim {
  mainsnak: Snak;
  rank: 'preferred' | 'normal' | 'deprecated';
}

export interface LabelEntry {
  language: string;
  value: string;
}

export interface WikidataEntity {
  id: string;
  type: string;
  labels?: Record<string, LabelEntry>;
  claims?: Record<string, Claim[]>;
  sitelinks?: Record<string, unknown>;
}

/** One row for `films`, ready to be loaded. */
export interface ExtractedFilm {
  wikidataId: string;
  imdbId: string | null;
  titleOriginal: string;
  titleDe: string | null;
  titleEn: string | null;
  releaseYear: number | null;
  runtimeMin: number | null;
  sitelinkCount: number;
}

export interface ExtractedCredit {
  filmId: string;
  personId: string;
  role: 'director' | 'cast' | 'writer';
  ord: number;
}

export interface ExtractedGenre {
  filmId: string;
  genreId: string;
}

export interface ExtractedEntity {
  film: ExtractedFilm;
  credits: ExtractedCredit[];
  genres: ExtractedGenre[];
}
