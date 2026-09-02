'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Was der Import nicht zuordnen konnte.
 *
 * Einzelne Fehler blockieren den Import nicht — der Rest laeuft durch,
 * und was uebrigbleibt, steht hier. Der Nutzer waehlt den richtigen Film
 * oder legt den Eintrag beiseite.
 *
 * Der Bereich erscheint nur, wenn es etwas zu klaeren gibt. Eine leere
 * Tafel "Nicht erkannt" auf einer Einstellungsseite waere eine Aufgabe,
 * die es nicht gibt.
 */

interface Offen {
  id: string;
  raw_title: string;
  raw_year: number | null;
  status: string;
}

interface Treffer {
  wikidata_id: string;
  title_de: string | null;
  title_original: string;
  release_year: number | null;
}

export function UnmatchedImports() {
  const [offen, setOffen] = useState<Offen[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [suche, setSuche] = useState<{ id: string; term: string; treffer: Treffer[] } | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    void laden();
  }, []);

  async function laden() {
    const supabase = createClient();
    const { data } = await supabase.rpc('unmatched_imports', { max_results: 200 });
    setOffen(data ?? []);
    setGeladen(true);
  }

  async function suchen(id: string, term: string) {
    setSuche({ id, term, treffer: [] });
    if (term.trim().length < 2) return;

    const supabase = createClient();
    const { data } = await supabase.rpc('search_films', { query: term, max_results: 8 });
    setSuche({ id, term, treffer: data ?? [] });
  }

  async function zuweisen(id: string, film: string) {
    setProblem(undefined);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('resolve_import_item', { item: id, film });

    if (error || !data) {
      setProblem('Das hat nicht geklappt.');
      return;
    }

    // Der naechste Durchlauf traegt ihn ein — angestossen wird er hier,
    // damit der Nutzer nicht raet, wann es passiert.
    const { data: zeile } = await supabase
      .from('import_items')
      .select('batch_id')
      .eq('id', id)
      .maybeSingle();

    if (zeile) {
      await supabase.functions.invoke('letterboxd-import', {
        body: { batchId: zeile.batch_id, mode: 'run' },
      });
    }

    setSuche(null);
    await laden();
  }

  async function beiseite(id: string) {
    const supabase = createClient();
    await supabase.rpc('skip_import_item', { item: id });
    await laden();
  }

  if (!geladen || offen.length === 0) return null;

  return (
    <section className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">Nicht erkannt</h2>
        <p className="text-muted-foreground text-xs">
          {offen.length === 1
            ? 'Ein Eintrag aus deinem Import ließ sich nicht sicher zuordnen.'
            : `${String(offen.length)} Einträge aus deinem Import ließen sich nicht sicher zuordnen.`}{' '}
          Such den richtigen Film oder leg den Eintrag beiseite.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {offen.map((eintrag) => (
          <li key={eintrag.id} className="border-border flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm">
                {eintrag.raw_title}
                {eintrag.raw_year ? (
                  <span className="text-muted-foreground tabular-nums"> ({eintrag.raw_year})</span>
                ) : null}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void suchen(eintrag.id, eintrag.raw_title)}
                  className="text-primary text-xs"
                >
                  Film suchen
                </button>
                <button
                  type="button"
                  onClick={() => void beiseite(eintrag.id)}
                  className="text-muted-foreground text-xs"
                >
                  Überspringen
                </button>
              </div>
            </div>

            {suche?.id === eintrag.id ? (
              <div className="flex flex-col gap-2">
                <input
                  type="search"
                  value={suche.term}
                  onChange={(event) => void suchen(eintrag.id, event.target.value)}
                  placeholder="Titel"
                  className="border-border bg-card rounded-md border px-2 py-1.5 text-sm"
                />
                {suche.treffer.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Nichts im Katalog. Such den Film über die Suche — dort kannst du ihn hinzufügen.
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {suche.treffer.map((film) => (
                      <li key={film.wikidata_id}>
                        <button
                          type="button"
                          onClick={() => void zuweisen(eintrag.id, film.wikidata_id)}
                          className="hover:bg-card w-full rounded px-2 py-1.5 text-left text-sm"
                        >
                          {film.title_de ?? film.title_original}
                          {film.release_year ? (
                            <span className="text-muted-foreground tabular-nums">
                              {' '}
                              ({film.release_year})
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {problem ? <p className="text-sm text-red-400">{problem}</p> : null}
    </section>
  );
}
