/**
 * Form und Groesse einer Feed-Seite.
 *
 * Eigenes Modul, weil `feed-actions.ts` unter `'use server'` steht und
 * dort nur asynchrone Funktionen exportiert werden duerfen — eine
 * Konstante daneben bricht den Build.
 */
export interface FeedEintrag {
  id: string;
  created_at: string;
  rating: number | null;
  review: string | null;
  has_spoilers: boolean;
  watched_on: string | null;
  is_rewatch: boolean;
  username: string;
  avatar_path: string | null;
  film_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
  poster_source: string | null;
  poster_url: string | null;
}

export const FEED_SEITE = 20;
