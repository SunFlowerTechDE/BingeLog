/**
 * Shared domain constants for the BingeLog schema.
 *
 * These mirror enums and check constraints defined in the migrations. The
 * migrations are the source of truth; anything here that drifts from them
 * is a bug in this file, not in the database.
 */
export type { Database, Json } from './types.generated.ts';

/** ADR-009. Order is the display order; the enum order in Postgres matches. */
export const FACET_KINDS = [
  'acting',
  'story',
  'directing',
  'cinematography',
  'sound',
  'production_design',
  'pacing',
] as const;

export type FacetKind = (typeof FACET_KINDS)[number];

/** UI labels are German, identifiers are English (see CLAUDE.md). */
export const FACET_LABELS_DE: Readonly<Record<FacetKind, string>> = {
  acting: 'Schauspiel',
  story: 'Story und Drehbuch',
  directing: 'Regie',
  cinematography: 'Bild und Kamera',
  sound: 'Ton und Musik',
  production_design: 'Setting und Ausstattung',
  pacing: 'Tempo',
};

export const CREDIT_ROLES = ['director', 'cast', 'writer'] as const;
export type CreditRole = (typeof CREDIT_ROLES)[number];

export const POSTER_SOURCES = ['tvdb', 'generated'] as const;
export type PosterSource = (typeof POSTER_SOURCES)[number];

/** Half stars are stored as 1..10 internally. */
export const RATING_MIN = 1;
export const RATING_MAX = 10;

/** Minimum public votes before a facet average is shown at all (ADR-009). */
export const FACET_MIN_VOTES = 5;

/** Distinct viewers required before a discussion thread opens (ADR-010). */
export const THREAD_ACTIVATION_VIEWERS = 5;

/** Messages a single user may post per hour (M0 0.4c). */
export const MESSAGE_RATE_LIMIT_PER_HOUR = 10;

export const MESSAGE_BODY_MAX_LENGTH = 2000;
