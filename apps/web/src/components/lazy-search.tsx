'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { fetchMissingFilm } from '@/lib/search-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Offered when a search finds nothing.
 *
 * A button rather than an automatic lookup. Every typo would otherwise
 * become a query against Wikidata, which is a donated service, and a
 * mistyped title can still match something — writing an unrelated film
 * into the catalog because someone slipped is worse than one more tap on
 * a path that is rare by definition.
 */
export function LazySearch({ term }: { term: string }) {
  const router = useRouter();
  const [note, setNote] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm">
        Nichts im Katalog. Der Film ist vielleicht noch nicht importiert.
      </p>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setNote(undefined);
          startTransition(async () => {
            const result = await fetchMissingFilm(term);
            if (result.error) {
              setNote(result.error);
              return;
            }
            // The catalog changed underneath the current result list.
            router.refresh();
          });
        }}
        className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm
                   disabled:opacity-60"
      >
        {pending ? 'Sucht bei Wikidata' : 'Bei Wikidata suchen'}
      </button>

      <ActionNote message={note} />
    </div>
  );
}
