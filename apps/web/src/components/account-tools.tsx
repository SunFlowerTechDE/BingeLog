'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  findAccount,
  actOnAccount,
  listAccounts,
  type Kontotreffer,
  type Kontozeile,
} from '@/lib/admin-actions';
import { ActionNote } from '@/components/action-note';
import { AdminTable, useListe, type Spalte } from '@/components/admin-table';
import { UsernameField } from '@/components/username-field';
import { Avatar } from '@/components/profile-parts';

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
 * Vorgefertigte Begruendungen.
 *
 * Sie sind ein **Anfang, kein Ende**: der gewaehlte Baustein landet im
 * Textfeld und laesst sich dort weiterschreiben. Ein Dropdown, das den
 * Text festlegt, produziert Mails, die niemandem etwas sagen — und
 * gerade diese Mail wird von einem Menschen gelesen, dem gerade etwas
 * weggenommen wurde.
 *
 * Formuliert wie an den Nutzer gerichtet, nicht wie eine Aktennotiz:
 * genau dieser Text steht spaeter in seinem Postfach.
 */
const BAUSTEINE: Record<string, string[]> = {
  password_reset: [
    'Es gab Hinweise auf einen unbefugten Zugriff auf dein Konto. Zur Sicherheit haben wir das Passwort zurückgesetzt.',
    'Du hast uns geschrieben, dass du nicht mehr in dein Konto kommst. Hier ist der Weg zu einem neuen Passwort.',
  ],
  username_reset: [
    'Dein Benutzername verstößt gegen unsere Regeln — er beleidigt, gibt eine andere Person vor oder ist Werbung.',
    'Du hast uns um einen anderen Benutzernamen gebeten.',
  ],
  email_change: [
    'Du hast uns geschrieben, dass du auf deine alte Adresse keinen Zugriff mehr hast.',
    'Die hinterlegte Adresse war dauerhaft nicht erreichbar. Wir haben sie auf deine Angabe hin geändert.',
  ],
  account_closed: [
    'Wiederholte Beleidigungen gegenüber anderen Nutzern, trotz Hinweis.',
    'Spam oder Werbung in Rezensionen und in der Diskussion.',
    'Mehrere Konten, angelegt um Bewertungen zu beeinflussen.',
    'Rechtswidrige Inhalte.',
    'Auf deinen eigenen Wunsch.',
  ],
  account_restored: [
    'Die erneute Prüfung hat ergeben, dass die Schließung nicht gerechtfertigt war. Entschuldige die Umstände.',
    'Die Sperrfrist ist abgelaufen.',
  ],
  note: [
    'Eine Meldung zu deinem Konto wurde geprüft. Wir haben keinen Verstoß festgestellt und nichts geändert.',
    'Wir haben eine Meldung zu deinem Verhalten erhalten. Das hier ist ein Hinweis, keine Maßnahme — beim nächsten Mal folgt eine.',
  ],
};

/**
 * Eingriffe in ein Konto (M4 4.7).
 *
 * Erst suchen, dann waehlen, dann begruenden. Die Begruendung steht
 * **vor** dem Knopf und nicht dahinter: sie geht als Mail an den
 * Nutzer, und was man aufschreiben muss, bevor man handelt, ueberlegt
 * man sich zweimal.
 */
/** Datum ohne Uhrzeit — bei einem Beitritt zaehlt die Minute nicht. */
function tag(wert: string): string {
  return new Date(wert).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Die Kontoliste.
 *
 * Zwanzig je Seite, jede Spalte sortierbar, Suche daneben. Die
 * Schnellinfo ist bewusst knapp: Bild, Name, wieviel eingetragen und
 * wieviel geschrieben. Das reicht, um zu sehen, mit wem man es zu tun
 * hat, bevor man in ein Konto greift.
 */
function Kontoliste({
  avatarBasis,
  onWaehlen,
}: {
  avatarBasis: string;
  onWaehlen: (username: string) => void;
}) {
  const l = useListe<Kontozeile>(listAccounts, 'created_at');
  // Erstes Laden im Effekt und nicht beim Rendern: waehrend des
  // Renderns Zustand zu setzen ist nicht erlaubt, und der Server warf
  // dafuer eine 500 mit leerer Seite. Die Liste haengt an nichts, was
  // sich aendert — deshalb genau einmal.
  useEffect(() => {
    l.holen('', 'created_at', true, 1);
  }, []); // bewusst einmalig: `holen` waere bei jedem Rendern neu

  const spalten: Spalte<Kontozeile>[] = [
    {
      key: 'username',
      label: 'Konto',
      zelle: (z) => (
        <button
          type="button"
          onClick={() => {
            onWaehlen(z.username);
          }}
          className="flex items-center gap-3 text-left"
        >
          {z.avatar_path ? (
            <img
              src={`${avatarBasis}${z.avatar_path}`}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar name={z.username} size={32} />
          )}
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">@{z.username}</span>
            {z.display_name ? (
              <span className="text-muted-foreground truncate text-xs">{z.display_name}</span>
            ) : null}
          </span>
        </button>
      ),
    },
    { key: 'entries', label: 'Einträge', zahl: true, zelle: (z) => z.entries },
    { key: 'ratings', label: 'Bewertungen', zahl: true, zelle: (z) => z.ratings },
    { key: 'reviews', label: 'Rezensionen', zahl: true, zelle: (z) => z.reviews },
    { key: 'lists', label: 'Listen', zahl: true, zelle: (z) => z.lists },
    { key: 'created_at', label: 'Dabei seit', zahl: true, zelle: (z) => tag(z.created_at) },
    {
      key: 'closed_at',
      label: 'Zustand',
      zelle: (z) =>
        z.closed_at ? (
          <span className="border-destructive text-destructive rounded-full border px-2 py-0.5 text-xs">
            geschlossen
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">offen</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Konto suchen</span>
        <input
          type="search"
          defaultValue=""
          onChange={(e) => {
            l.suchen(e.target.value);
          }}
          placeholder="Benutzername oder angezeigter Name"
          autoComplete="off"
          className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
        />
      </label>

      <AdminTable
        spalten={spalten}
        zeilen={l.zeilen}
        gesamt={l.zeilen[0]?.gesamt ?? 0}
        seite={l.seite}
        sortieren={l.sortieren}
        absteigend={l.absteigend}
        laedt={l.laedt}
        onSortieren={l.umschalten}
        onSeite={l.blaettern}
        schluessel={(z) => z.username}
      />
    </div>
  );
}

export function AccountTools({ avatarBasis }: { avatarBasis: string }) {
  const [gewaehlt, setGewaehlt] = useState<Kontotreffer | null>(null);
  const [eingriff, setEingriff] = useState<(typeof EINGRIFFE)[number]['wert']>('note');
  const [wert, setWert] = useState('');
  const [grund, setGrund] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  const gewaehlterEingriff = EINGRIFFE.find((e) => e.wert === eingriff);

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
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {gewaehlt === null ? (
        <Kontoliste
          avatarBasis={avatarBasis}
          onWaehlen={(username) => {
            void findAccount(username).then((t) => {
              const genau = t.find((x) => x.username === username);
              if (genau) setGewaehlt(genau);
            });
          }}
        />
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

          {/* Beim Benutzernamen dasselbe Feld wie bei der Anmeldung:
              es schreibt klein und prueft, ob der Name frei ist. Einen
              reservierten oder vergebenen Namen zu setzen scheitert
              sonst erst an der Datenbank, nachdem die Mail schon
              geschrieben ist. */}
          {eingriff === 'username_reset' ? (
            <UsernameField
              name="neuerName"
              label="Neuer Benutzername"
              startwert={wert}
              onChange={setWert}
            />
          ) : gewaehlterEingriff?.braucht ? (
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
            <span className="text-sm font-medium">Textbaustein</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value !== '') setGrund(e.target.value);
              }}
              className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
            >
              <option value="">Eigener Text</option>
              {(BAUSTEINE[eingriff] ?? []).map((b) => (
                <option key={b} value={b}>
                  {b.length > 70 ? `${b.slice(0, 70)}…` : b}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground text-xs">
              Setzt den Text unten. Ändern kannst du ihn danach trotzdem.
            </span>
          </label>

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
            {/* Der Text geht wortwoertlich raus. Das gehoert dazugesagt,
                bevor jemand hier eine Aktennotiz hinterlaesst. */}
            <span className="text-muted-foreground text-xs">
              Steht so in der Mail an @{gewaehlt.username}.
            </span>
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
