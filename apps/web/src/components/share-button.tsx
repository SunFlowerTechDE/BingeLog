'use client';

import { useState } from 'react';

/**
 * Eine Adresse weitergeben.
 *
 * Wo das Geraet eine eigene Teilen-Auswahl hat, bekommt es sie — auf dem
 * Handy ist das der gewohnte Weg. Sonst wandert die Adresse in die
 * Zwischenablage, und der Knopf sagt es fuer zwei Sekunden. Ein Knopf,
 * der nichts sagt, wirkt kaputt.
 */
export function ShareButton({ pfad, titel }: { pfad?: string; titel?: string }) {
  const [kopiert, setKopiert] = useState(false);

  const teilen = async () => {
    // Ohne Angabe die Seite, auf der man steht. Das ist fast immer das
    // Gemeinte und geht nie am Ziel vorbei.
    const url = pfad ? `${window.location.origin}${pfad}` : window.location.href;

    // Die Typen behaupten, es gebe die Auswahl immer. Firefox am
    // Schreibtisch hat sie nicht, deshalb wird gefragt statt geglaubt.
    if ('share' in navigator) {
      try {
        await navigator.share({ title: titel ?? document.title, url });
        return;
      } catch {
        // Abgebrochen oder abgelehnt: dann eben die Zwischenablage.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setKopiert(true);
      setTimeout(() => {
        setKopiert(false);
      }, 2000);
    } catch {
      // Ohne Zwischenablage bleibt nichts zu tun. Lieber nichts sagen
      // als etwas Falsches behaupten.
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void teilen();
      }}
      className="border-border hover:bg-card inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
    >
      {kopiert ? 'Adresse kopiert' : 'Teilen'}
    </button>
  );
}
