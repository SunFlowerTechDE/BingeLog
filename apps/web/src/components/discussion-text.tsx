'use client';

import { useState } from 'react';

import { zerlegen, type Baustein } from '@/lib/discussion-text';

/**
 * Ein Beitrag, dargestellt.
 *
 * Aus Bausteinen und nie aus HTML: der Text des Nutzers wird zu React-
 * Kindern, nicht zu Markup. Damit kann kein Beitrag der Welt etwas
 * anderes werden als Text.
 */
function Stueck({ teil }: { teil: Baustein }) {
  if (teil.art === 'text') return <>{teil.wert}</>;
  if (teil.art === 'fett') return <strong className="font-semibold">{teil.wert}</strong>;
  if (teil.art === 'kursiv') return <em>{teil.wert}</em>;
  return <Verdeckt teile={teil.teile} />;
}

/**
 * Ein verdeckter Block.
 *
 * Auch unter Leuten, die den Film gesehen haben, gibt es Spoiler fuer
 * **andere** Filme. Aufgedeckt wird durch Klick und bleibt aufgedeckt —
 * ein Block, der sich wieder schliesst, waere ein Spielzeug.
 */
function Verdeckt({ teile }: { teile: Baustein[] }) {
  const [offen, setOffen] = useState(false);

  if (offen) {
    return (
      <span className="bg-card rounded px-1">
        {teile.map((t, i) => (
          <Stueck key={i} teil={t} />
        ))}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setOffen(true);
      }}
      className="bg-muted-foreground/30 text-muted-foreground/30 hover:text-muted-foreground/50 select-none rounded px-1"
      aria-label="Verdeckten Text aufdecken"
    >
      {teile.map((t, i) => (
        <Stueck key={i} teil={t} />
      ))}
    </button>
  );
}

export function DiscussionText({ body }: { body: string }) {
  const teile = zerlegen(body);
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed">
      {teile.map((t, i) => (
        <Stueck key={i} teil={t} />
      ))}
    </p>
  );
}
