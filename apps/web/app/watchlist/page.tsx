import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { WatchlistPage } from '@/components/watchlist-page';
import type { WatchlistEintrag } from '@/lib/watchlist';

export const metadata: Metadata = { title: 'Watchlist' };

/**
 * M3 3.3 — die Watchlist, nach dem Konzept (19-web-nachziehen 9).
 *
 * Privat durch die Policy und nicht durch Auswahl: die Tabelle hat keine
 * Lesepolicy für andere als den Besitzer, solange er sie nicht öffnet.
 * Was jemand noch **nicht** gesehen hat, sagt etwas anderes als das, was
 * er gesehen hat (M0 0.4).
 *
 * `watchlist_for_me()` liefert alles in **einer** Antwort — Bewertung,
 * Genres, Empfehlungen, Priorität, Gruppen und wer aus dem Freundeskreis
 * ihn schon gesehen hat. Gefiltert und sortiert wird danach im Browser.
 */
export default async function WatchlistRoute() {
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();

  const [{ data: rows }, { data: gruppenRows }] = await Promise.all([
    supabase.rpc('watchlist_for_me'),
    supabase.rpc('watchlist_groups_for_me'),
  ]);

  const eintraege = (rows ?? []) as unknown as WatchlistEintrag[];
  const gruppen = (gruppenRows ?? []).map((g) => ({ id: g.id, name: g.name }));

  // Die Übereinstimmung kommt in einer eigenen Anfrage und bleibt leer,
  // solange das Geschmacksprofil sie nicht trägt — **die Schwelle setzt
  // die Datenbank**, nicht diese Seite.
  const matches: Record<string, number> = {};
  if (eintraege.length > 0) {
    const { data: matchRows } = await supabase.rpc('film_match', {
      films: eintraege.map((e) => e.film_id),
    });
    for (const zeile of matchRows ?? []) matches[zeile.film_id] = zeile.match;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Watchlist</h1>
        <p className="text-muted-foreground text-sm tabular-nums">
          {eintraege.length === 1 ? '1 Film' : `${String(eintraege.length)} Filme`}
        </p>
      </div>

      <WatchlistPage eintraege={eintraege} gruppen={gruppen} matches={matches} />
    </main>
  );
}
