'use client';

import { useState } from 'react';

/**
 * Eine Rezension, die als Spoiler markiert ist.
 *
 * **Das ist kein Zugriffsschutz** und soll keiner sein — der Text kommt
 * über dieselbe Antwort wie jeder andere, und wer die Antwort liest,
 * liest ihn. Das Spoiler-Gate der Diskussion ist etwas anderes und steht
 * in der Policy (ADR-010).
 *
 * Aber die Bitte des Verfassers gehört respektiert, und ein Tagebuch,
 * das jede Pointe ungefragt aufdeckt, ist keins.
 */
export function SpoilerText({ text, className }: { text: string; className?: string }) {
  const [offen, setOffen] = useState(false);

  if (offen) return <p className={className}>{text}</p>;

  return (
    <button
      type="button"
      onClick={() => {
        setOffen(true);
      }}
      className="border-border bg-card/60 hover:bg-card w-full rounded-md border border-dashed px-3 py-2 text-left"
    >
      <span className="text-muted-foreground text-xs">Enthält Spoiler · Klicken zum Anzeigen</span>
    </button>
  );
}
