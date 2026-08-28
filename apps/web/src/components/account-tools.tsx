'use client';

import { useState, useTransition } from 'react';

import { findAccount, actOnAccount, type Kontotreffer } from '@/lib/admin-actions';
import { ActionNote } from '@/components/action-note';

const EINGRIFFE = [
  {
    wert: 'password_reset',
    label: 'Passwort zurücksetzen',
    hinweis: 'Löst die Zurücksetz-Mail aus. Das neue Passwort wählt der Nutzer — du siehst es nie.',
    braucht: null,
  },
  {
    wert: 'username_reset',
    label: 'Benutzername ändern',
    hinweis: 'Alte Links auf das Profil laufen danach ins Leere.',
    braucht: 'Neuer Benutzername',
  },
  {
    wert: 'email_change',
    label: 'E-Mail-Adresse ändern',
    hinweis: 'Beide Adressen werden benachrichtigt — die alte und die neue.',
    braucht: 'Neue Adresse',
  },
  {
    wert: 'account_closed',
    label: 'Konto schließen',
    hinweis: 'Kein Login mehr. Die Einträge bleiben stehen: sie sind Belege zu Meldungen.',
    braucht: null,
  },
  {
    wert: 'account_restored',
    label: 'Konto wieder öffnen',
    hinweis: 'Hebt eine Schließung auf.',
    braucht: null,
  },
  {
    wert: 'note',
    label: 'Nur vermerken',
    hinweis: 'Kein Eingriff, nur eine Zeile im Logbuch.',
    braucht: null,
  },
] as const;

/**
 * Eingriffe in ein Konto (M4 4.7).
 *
 * Erst suchen, dann waehlen, dann begruenden. Die Begruendung steht
 * **vor** dem Knopf und nicht dahinter: sie geht als Mail an den
 * Nutzer, und was man aufschreiben muss, bevor man handelt, ueberlegt
 * man sich zweimal.
 */
export function AccountTools() {
  const [term, setTerm] = useState('');
  const [treffer, setTreffer] = useState<Kontotreffer[]>([]);
  const [gewaehlt, setGewaehlt] = useState<Kontotreffer | null>(null);
  const [eingriff, setEingriff] = useState<(typeof EINGRIFFE)[number]['wert']>('note');
  const [wert, setWert] = useState('');
  const [grund, setGrund] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const gewaehlterEingriff = EINGRIFFE.find((e) => e.wert === eingriff);

  const suchen = (v: string) => {
    setTerm(v);
    if (v.trim().length < 2) {
      setTreffer([]);
      return;
    }
    void findAccount(v).then(setTreffer);
  };

  const ausfuehren = () => {
    if (!gewaehlt) return;
    setProblem(undefined);
    setMeldung(undefined);
    startTransition(async () => {
      const r = await actOnAccount(eingriff, gewaehlt.username, grund, wert || undefined);
      if (r.error) setProblem(r.error);
      else {
        setMeldung(r.message);
        setGrund('');
        setWert('');
        setGewaehlt(null);
        setTerm('');
        setTreffer([]);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {gewaehlt === null ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Konto suchen</span>
            <input
              type="search"
              value={term}
              onChange={(e) => {
                suchen(e.target.value);
              }}
              placeholder="Benutzername"
              autoComplete="off"
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>

          <ul className="flex flex-col gap-1">
            {treffer.map((t) => (
              <li key={t.username}>
                <button
                  type="button"
                  onClick={() => {
                    setGewaehlt(t);
                  }}
                  className="hover:bg-card flex w-full items-center gap-3 rounded-md p-2 text-left"
                >
                  <span className="text-sm font-medium">@{t.username}</span>
                  {t.display_name ? (
                    <span className="text-muted-foreground text-xs">{t.display_name}</span>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                    {t.eintraege} Einträge
                  </span>
                  {t.closed_at ? (
                    <span className="border-destructive text-destructive rounded-full border px-2 py-0.5 text-xs">
                      geschlossen
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">@{gewaehlt.username}</span>
            {gewaehlt.closed_at ? (
              <span className="border-destructive text-destructive rounded-full border px-2 py-0.5 text-xs">
                geschlossen
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setGewaehlt(null);
              }}
              className="text-muted-foreground hover:text-foreground ml-auto text-sm underline underline-offset-4"
            >
              Anderes Konto
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Was soll passieren?</span>
            <select
              value={eingriff}
              onChange={(e) => {
                setEingriff(e.target.value as (typeof EINGRIFFE)[number]['wert']);
                setWert('');
              }}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            >
              {EINGRIFFE.map((e) => (
                <option key={e.wert} value={e.wert}>
                  {e.label}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-xs">{gewaehlterEingriff?.hinweis}</span>
          </label>

          {gewaehlterEingriff?.braucht ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{gewaehlterEingriff.braucht}</span>
              <input
                type="text"
                value={wert}
                onChange={(e) => {
                  setWert(e.target.value);
                }}
                className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Begründung</span>
            <textarea
              value={grund}
              onChange={(e) => {
                setGrund(e.target.value);
              }}
              rows={3}
              maxLength={2000}
              placeholder="Warum greifst du ein? Der Nutzer bekommt genau diesen Text."
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={laeuft || grund.trim().length < 3}
              onClick={() => {
                if (
                  eingriff === 'account_closed' &&
                  !confirm(`Konto @${gewaehlt.username} schließen?`)
                ) {
                  return;
                }
                ausfuehren();
              }}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              {laeuft ? 'Läuft' : 'Ausführen'}
            </button>
            <span className="text-muted-foreground text-xs">
              Wird im Logbuch festgehalten und dem Nutzer gemailt.
            </span>
          </div>
        </div>
      )}

      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </div>
  );
}
