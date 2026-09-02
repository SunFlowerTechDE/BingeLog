import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/session';
import { formatRating } from '@/components/popcorn';
import { DiaryPage } from '@/components/diary-page';
import type { DiaryEintrag } from '@/lib/diary';

export const metadata: Metadata = { title: 'Tagebuch' };

/**
 * Das Tagebuch (M3 3.4, Tagebuch-Konzept — 19-web-nachziehen 11).
 *
 * `diary_for_me()` und `diary_summary()` liefern beides in zwei
 * Antworten. Gefiltert, sortiert und gruppiert wird danach im Browser.
 */
export default async function DiaryRoute() {
  // Unangemeldete kommen nie an: der Proxy schickt sie mit dem Ziel im
  // Gepäck nach /anmelden.
  const viewer = await getViewer();
  if (!viewer) return null;

  const supabase = await createClient();

  const [{ data: rows }, { data: summaryRows }] = await Promise.all([
    supabase.rpc('diary_for_me'),
    supabase.rpc('diary_summary'),
  ]);

  const eintraege = (rows ?? []) as unknown as DiaryEintrag[];
  const summary = summaryRows?.[0];

  // `numeric` kommt als Zeichenkette an — die erzeugten Typen behaupten
  // `number`, und das ist eine Schwaeche der Typerzeugung, nicht der
  // Funktion.
  const roh: unknown = summary?.average;
  const schnitt = roh === null || roh === undefined ? null : Number(roh);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tagebuch</h1>

        {eintraege.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Noch nichts eingetragen. Auf einer Filmseite steht der Knopf dafür.
          </p>
        ) : (
          <dl className="flex flex-wrap gap-6">
            <Zahl wert={String(summary?.entries ?? 0)} was="Einträge" />
            <Zahl wert={String(summary?.this_year ?? 0)} was="dieses Jahr" />
            <Zahl wert={schnitt === null ? '—' : formatRating(schnitt)} was="im Schnitt" />
          </dl>
        )}
      </div>

      {eintraege.length === 0 ? null : <DiaryPage eintraege={eintraege} />}
    </main>
  );
}

function Zahl({ wert, was }: { wert: string; was: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xl font-semibold tabular-nums">{wert}</dt>
      <dd className="text-muted-foreground text-xs">{was}</dd>
    </div>
  );
}
