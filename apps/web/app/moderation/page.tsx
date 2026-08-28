import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { isModerator } from '@/lib/moderation';
import { ReportQueue, type Meldung } from '@/components/report-queue';

export const metadata: Metadata = { title: 'Moderation' };

/**
 * Die Warteschlange (M4 4.7).
 *
 * **404 und nicht "keine Berechtigung."** Letzteres bestaetigt, dass es
 * die Seite gibt. Fuer alle anderen existiert sie schlicht nicht.
 *
 * Der eigentliche Schutz steht ohnehin nicht hier: die Policy auf
 * `reports` gibt Fremden null Zeilen, egal ob sie die Adresse kennen,
 * die API direkt ansprechen oder den anon-Schluessel aus dem Bundle
 * nehmen. Diese Pruefung erspart nur die leere Seite.
 */
export default async function ModerationPage() {
  if (!(await isModerator())) notFound();

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('reports')
    .select(
      'id, target_kind, target_id, reason, body, status, created_at, decision, ' +
        'reporter_email, profiles!reports_reporter_id_fkey(username), report_images(path)',
    )
    // Aelteste zuerst, offene zuerst: eine Warteschlange, keine
    // Nachrichtenlage.
    .order('status')
    .order('created_at', { ascending: true })
    .limit(100);

  const roh = (rows ?? []) as unknown as (Omit<Meldung, 'bilder' | 'melder'> & {
    reporter_email: string | null;
    profiles: { username: string } | null;
    report_images: { path: string }[];
  })[];

  // Signierte Adressen mit kurzer Laufzeit: der Bucket ist nicht
  // oeffentlich, und das soll er auch nicht werden.
  const meldungen: Meldung[] = await Promise.all(
    roh.map(async (r) => {
      const bilder = await Promise.all(
        r.report_images.map(async (b) => {
          const { data } = await supabase.storage.from('reports').createSignedUrl(b.path, 600);
          return data?.signedUrl ?? '';
        }),
      );

      return {
        id: r.id,
        target_kind: r.target_kind,
        target_id: r.target_id,
        reason: r.reason,
        body: r.body,
        status: r.status,
        created_at: r.created_at,
        decision: r.decision,
        melder: r.profiles?.username ?? r.reporter_email ?? 'unbekannt',
        bilder: bilder.filter((b) => b !== ''),
      };
    }),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Moderation</h1>
        <p className="text-muted-foreground text-sm">
          Offene Meldungen zuerst, älteste oben. Jede Entscheidung wird festgehalten.
        </p>
      </div>

      <ReportQueue meldungen={meldungen} />
    </main>
  );
}
