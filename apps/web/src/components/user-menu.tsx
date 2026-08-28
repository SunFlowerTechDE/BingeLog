'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useRef, useState } from 'react';

import { Symbol } from '@/components/icons';
import { Avatar } from '@/components/profile-parts';

/**
 * Wer man ist, rechts aussen.
 *
 * Vorher standen Profil, Einstellungen und Abmelden als drei gleich
 * laute Woerter neben den Zielen der Navigation. Sie gehoeren nicht
 * dorthin: man geht selten hin, und "Abmelden" so dicht am Rest ist ein
 * Klick, den niemand wollte.
 *
 * Geschlossen wird bei Klick nach draussen und mit Escape. Beides, nicht
 * eins davon — ohne Escape bleibt das Menue an der Tastatur haengen,
 * ohne den Klick nach draussen an der Maus.
 */
export function UserMenu({
  username,
  avatarUrl,
  abmelden,
}: {
  username: string;
  avatarUrl: string | null;
  /** Die Server-Aktion. Als Kind uebergeben, damit dieses Bauteil sie
      nicht kennen muss. */
  abmelden: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!offen) return;

    const draussen = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };

    document.addEventListener('mousedown', draussen);
    document.addEventListener('keydown', taste);
    return () => {
      document.removeEventListener('mousedown', draussen);
      document.removeEventListener('keydown', taste);
    };
  }, [offen]);

  return (
    <div ref={huelle} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        aria-haspopup="menu"
        onClick={() => {
          setOffen((v) => !v);
        }}
        className="hover:bg-card flex items-center gap-2 rounded-md py-1 pl-1 pr-2 text-sm"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <Avatar name={username} size={28} />
        )}
        <span className="hidden max-w-[9rem] truncate sm:inline">{username}</span>
        <span className="text-muted-foreground">
          <Symbol art="pfeilRunter" size={15} />
        </span>
      </button>

      {offen ? (
        <div
          role="menu"
          className="border-border bg-card absolute right-0 z-20 mt-2 flex w-52 flex-col rounded-lg border p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href={`/@${username}` as Route}
            onClick={() => {
              setOffen(false);
            }}
            className="hover:bg-background rounded-md px-3 py-2 text-sm"
          >
            Mein Profil
          </Link>
          <Link
            role="menuitem"
            href={`/@${username}/listen` as Route}
            onClick={() => {
              setOffen(false);
            }}
            className="hover:bg-background rounded-md px-3 py-2 text-sm"
          >
            Meine Listen
          </Link>
          <Link
            role="menuitem"
            href="/einstellungen"
            onClick={() => {
              setOffen(false);
            }}
            className="hover:bg-background rounded-md px-3 py-2 text-sm"
          >
            Einstellungen
          </Link>
          <div className="border-border my-1 border-t" />
          {abmelden}
        </div>
      ) : null}
    </div>
  );
}
