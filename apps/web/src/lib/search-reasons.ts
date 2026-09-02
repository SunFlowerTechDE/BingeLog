/**
 * Die Gründe, aus denen nichts gefunden wurde.
 *
 * **Eigenes Modul, nicht in `search-actions.ts`.** Eine Datei unter
 * `'use server'` darf nur asynchrone Funktionen exportieren; eine
 * synchrone daneben bricht den Build — und zwar erst beim Bauen, nicht
 * beim Typecheck.
 */

/** Ob es sich lohnt, das Jahr wegzulassen. */
export function suggestsDroppingTheYear(reason: string | undefined): boolean {
  return reason === 'wrong_year';
}
