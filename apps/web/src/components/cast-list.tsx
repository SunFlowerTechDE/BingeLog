'use client';

import { useState } from 'react';

/**
 * Die Besetzung, standardmaessig gekuerzt.
 *
 * Zwoelf Namen fuellen zwei Zeilen; alles darueber schiebt den Rest der
 * Seite nach unten, ohne dass jemand danach gefragt haette. Wer die
 * vollstaendige Liste will, klappt sie auf.
 */
export function CastList({ names, shown = 12 }: { names: string[]; shown?: number }) {
  const [open, setOpen] = useState(false);
  const hidden = names.length - shown;
  const visible = open ? names : names.slice(0, shown);

  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-muted-foreground text-xs">Besetzung</h2>
      <p className="text-sm leading-relaxed">{visible.join(' · ')}</p>
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => {
            setOpen(!open);
          }}
          aria-expanded={open}
          className="text-primary self-start text-sm underline underline-offset-4"
        >
          {open ? 'Weniger anzeigen' : `Mehr anzeigen (${String(hidden)})`}
        </button>
      ) : null}
    </div>
  );
}
