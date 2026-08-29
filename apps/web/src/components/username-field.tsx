'use client';

import { useEffect, useState } from 'react';

import { checkUsername } from '@/lib/auth-actions';
import { bereinigen, namenstext, type Namenslage } from '@/lib/username';

/**
 * Ein Feld fuer einen Benutzernamen.
 *
 * Zwei Dinge, die es vorher nicht gab.
 *
 * **Es schreibt selbst klein.** Wer „BingeLog" tippt, sieht sofort
 * „bingelog" statt spaeter eine rote Zeile. Nur Kleinbuchstaben ist eine
 * Regel der Datenbank, keine Meinung — aber sie dem Nutzer als Fehler zu
 * praesentieren war eine Entscheidung, und eine schlechte.
 *
 * **Es sagt waehrend des Tippens, ob der Name zu haben ist.** Reserviert
 * und vergeben werden beide vorher geprueft. Die Antwort ist ein
 * Hinweis, keine Zusage: entschieden wird beim Absenden in der
 * Datenbank.
 */
export function UsernameField({
  name = 'username',
  label = 'Benutzername',
  hinweis,
  startwert = '',
  onChange,
}: {
  name?: string;
  label?: string;
  hinweis?: string;
  startwert?: string;
  onChange?: (wert: string) => void;
}) {
  const [wert, setWert] = useState(startwert);
  const [lage, setLage] = useState<Namenslage>({ lage: 'leer' });
  const [prueft, setPrueft] = useState(false);

  // Gebremst: eine Abfrage je Tastendruck waere eine Abfrage zu viel.
  useEffect(() => {
    if (wert === '') {
      setLage({ lage: 'leer' });
      return;
    }
    setPrueft(true);
    const uhr = setTimeout(() => {
      void checkUsername(wert).then((l) => {
        setLage(l);
        setPrueft(false);
      });
    }, 350);
    return () => {
      clearTimeout(uhr);
    };
  }, [wert]);

  const farbe =
    lage.lage === 'frei'
      ? 'text-primary'
      : lage.lage === 'vergeben' || lage.lage === 'reserviert'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="text"
        name={name}
        value={wert}
        onChange={(e) => {
          const sauber = bereinigen(e.target.value);
          setWert(sauber);
          onChange?.(sauber);
        }}
        maxLength={20}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
      />
      <span className="flex flex-wrap gap-x-3 text-xs">
        <span className="text-muted-foreground">
          {hinweis ?? 'Drei bis zwanzig Zeichen, nur Kleinbuchstaben, Ziffern und _.'}
        </span>
        {wert === '' ? null : prueft ? (
          <span className="text-muted-foreground">wird geprüft…</span>
        ) : (
          <span className={farbe}>{namenstext(lage)}</span>
        )}
      </span>
    </label>
  );
}
