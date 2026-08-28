import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { createClient } from '@/lib/supabase/server';
import { isModerator } from '@/lib/moderation';
import { ReportQueue, type Meldung } from '@/components/report-queue';
import { AdminNumbers, type Zahlen } from '@/components/admin-numbers';
import { AccountTools } from '@/components/account-tools';

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
const EINGRIFF: Record<string, string> = {
  password_reset: 'Passwort zurückgesetzt',
  username_reset: 'Benutzername geändert',
  email_change: 'E-Mail geändert',
  account_closed: 'Konto geschlossen',
  account_restored: 'Konto geöffnet',
  content_removed: 'Inhalt entfernt',
  note: 'Vermerk',
};

/** Auf die Minute genau: bei einem Eingriff zaehlt die Uhrzeit. */
function zeitpunkt(wert: string): string {
  return new Date(wert).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function ModerationPage() {
  if (!(await isModerator())) notFound();

  const supabase = await createClient();

  // Die Funktion prueft die Rolle selbst — sie zaehlt an der RLS vorbei
  // und waere ohne diese Pruefung ein Leck (20260828360000).
  const { data: zahlenRows } = await supabase.rpc('admin_overview');
  const zahlen: Zahlen | null = zahlenRows?.[0] ?? null;

  // Das Logbuch. Neueste zuerst — hier sucht man, was gerade passiert
  // ist, nicht was am Anfang war.
  const { data: logbuch } = await supabase
    .from('account_actions')
    .select('id, target_name, actor_name, action, reason, details, notified, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

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
          Zahlen, Meldungen, Eingriffe. Jede Entscheidung wird festgehalten.
        </p>
      </div>

      {zahlen ? <AdminNumbers z={zahlen} /> : null}

      <section className="border-border flex flex-col gap-4 border-t pt-8">
        <h2 className="text-base font-semibold tracking-tight">Meldungen</h2>
        <ReportQueue meldungen={meldungen} />
      </section>

      <section className="border-border flex flex-col gap-4 border-t pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Konten</h2>
          <p className="text-muted-foreground text-sm">
            Eingriffe in fremde Konten. Jeder wird protokolliert und dem Nutzer gemailt.
          </p>
        </div>
        <AccountTools />
      </section>

      <section className="border-border flex flex-col gap-4 border-t pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">Logbuch</h2>
          <p className="text-muted-foreground text-sm">
            Was wann von wem an welchem Konto getan wurde. Wird nie gelöscht.
          </p>
        </div>

        {(logbuch ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">Noch kein Eintrag.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {(logbuch ?? []).map((z) => (
              <li
                key={z.id}
                className="border-border bg-card/40 flex flex-col gap-1 rounded-lg border p-4"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-medium">{EINGRIFF[z.action] ?? z.action}</span>
                  <span className="text-muted-foreground">an @{z.target_name}</span>
                  <span className="text-muted-foreground">durch @{z.actor_name}</span>
                  {/* Eine ausstehende Benachrichtigung muss auffallen —
                      sie ist das, was nachgeholt werden muss. */}
                  {z.notified ? null : (
                    <span className="border-destructive text-destructive rounded-full border px-2 py-0.5">
                      nicht benachrichtigt
                    </span>
                  )}
                  <span className="text-muted-foreground ml-auto">{zeitpunkt(z.created_at)}</span>
                </div>
                <p className="text-sm leading-relaxed">{z.reason}</p>
                {z.details ? (
                  <p className="text-muted-foreground text-xs">
                    {JSON.stringify(z.details).replace(/[{}"]/g, '').replace(/,/g, ' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
