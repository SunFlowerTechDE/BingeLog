'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useState, useTransition } from 'react';

import { decideReport, removeReportedMessage } from '@/lib/moderation-actions';
import { ActionNote } from '@/components/action-note';

export interface Meldung {
  id: string;
  target_kind: 'message' | 'review' | 'profile' | 'list' | 'other';
  target_id: string;
  reason: string;
  body: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'rejected';
  created_at: string;
  decision: string | null;
  melder: string;
  bilder: string[];
}

const GRUND: Record<string, string> = {
  spoiler: 'Unmarkierter Spoiler',
  harassment: 'Beleidigung oder Belästigung',
  hate: 'Hass oder Hetze',
  sexual: 'Sexueller Inhalt',
  violence: 'Gewaltdarstellung',
  spam: 'Spam oder Werbung',
  illegal: 'Sonst rechtswidrig',
  other: 'Etwas anderes',
};

const ZUSTAND: Record<string, string> = {
  open: 'Offen',
  in_progress: 'In Arbeit',
  resolved: 'Entschieden',
  rejected: 'Abgewiesen',
};

const ART: Record<string, string> = {
  message: 'Diskussionsbeitrag',
  review: 'Rezension',
  profile: 'Profil',
  list: 'Binge-Liste',
  other: 'Sonstiges',
};

function wann(wert: string): string {
  return new Date(wert).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReportQueue({ meldungen }: { meldungen: Meldung[] }) {
  const [liste, setListe] = useState(meldungen);
  const [begruendung, setBegruendung] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const entscheiden = (m: Meldung, status: 'resolved' | 'rejected') => {
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const text = begruendung[m.id] ?? '';
      const r = await decideReport(m.id, status, text);
      if (r.error) {
        setProblem(r.error);
        return;
      }
      setMeldung(r.message);
      setListe(liste.map((x) => (x.id === m.id ? { ...x, status, decision: text } : x)));
    });
  };

  if (liste.length === 0) {
    return <p className="text-muted-foreground text-sm">Nichts offen. Angenehm.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />

      <ol className="flex flex-col gap-5">
        {liste.map((m) => (
          <li
            key={m.id}
            className="border-border bg-card/40 flex flex-col gap-3 rounded-xl border p-5"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  m.status === 'open'
                    ? 'bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground border'
                }`}
              >
                {ZUSTAND[m.status]}
              </span>
              <span className="font-medium">{GRUND[m.reason] ?? m.reason}</span>
              <span className="text-muted-foreground">{ART[m.target_kind]}</span>
              <span className="text-muted-foreground ml-auto">{wann(m.created_at)}</span>
            </div>

            <p className="text-muted-foreground text-xs">
              Gemeldet von {m.melder} · Ziel <code className="text-[11px]">{m.target_id}</code>
              {m.target_kind === 'profile' ? (
                <>
                  {' · '}
                  <Link href={`/@${m.target_id}` as Route} className="underline underline-offset-4">
                    ansehen
                  </Link>
                </>
              ) : null}
              {m.target_kind === 'list' ? (
                <>
                  {' · '}
                  <Link
                    href={`/listen/${m.target_id}` as Route}
                    className="underline underline-offset-4"
                  >
                    ansehen
                  </Link>
                </>
              ) : null}
            </p>

            {m.body ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{m.body}</p>
            ) : null}

            {m.bilder.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {m.bilder.map((b) => (
                  <li key={b}>
                    {/* Signierte Adresse, zehn Minuten gueltig. Der Bucket
                        ist nicht oeffentlich und bleibt es nicht. */}
                    <a href={b} target="_blank" rel="noreferrer">
                      <img
                        src={b}
                        alt=""
                        className="border-border h-24 w-24 rounded border object-cover"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}

            {m.status === 'open' || m.status === 'in_progress' ? (
              <div className="flex flex-col gap-3 pt-1">
                <textarea
                  rows={2}
                  maxLength={2000}
                  value={begruendung[m.id] ?? ''}
                  onChange={(e) => {
                    setBegruendung({ ...begruendung, [m.id]: e.target.value });
                  }}
                  placeholder="Begründung — geht an beide Seiten"
                  className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => {
                      entscheiden(m, 'resolved');
                    }}
                    className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
                  >
                    Berechtigt
                  </button>
                  <button
                    type="button"
                    disabled={laeuft}
                    onClick={() => {
                      entscheiden(m, 'rejected');
                    }}
                    className="border-border hover:bg-card rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                  >
                    Abweisen
                  </button>
                  {m.target_kind === 'message' ? (
                    <button
                      type="button"
                      disabled={laeuft}
                      onClick={() => {
                        startTransition(async () => {
                          const r = await removeReportedMessage(m.target_id);
                          if (r.error) setProblem(r.error);
                          else setMeldung(r.message);
                        });
                      }}
                      className="text-muted-foreground hover:text-destructive ml-auto text-sm underline underline-offset-4 disabled:opacity-60"
                    >
                      Beitrag entfernen
                    </button>
                  ) : null}
                </div>
              </div>
            ) : m.decision ? (
              <p className="border-border text-muted-foreground border-t pt-3 text-sm">
                <span className="font-medium">Begründung:</span> {m.decision}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
