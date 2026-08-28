'use client';

import { useState, useTransition } from 'react';

import { follow, unfollow } from '@/lib/follow-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Folgen und Entfolgen.
 *
 * Der Zustand wird sofort umgeschaltet und bei einem Fehler
 * zurueckgenommen: das Folgen ist eine Kleinigkeit, und auf eine
 * Antwort vom Server zu warten macht daraus eine Handlung.
 *
 * Zeigt an, wenn beide Seiten folgen — das ist keine Verzierung,
 * sondern die Bedingung, unter der Eintraege der Stufe "Nur fuer
 * Freunde" sichtbar werden. Wer das nicht sieht, weiss nicht, warum er
 * etwas sieht oder nicht.
 */
export function FollowButton({
  username,
  initiallyFollowing,
  followsBack,
}: {
  username: string;
  initiallyFollowing: boolean;
  followsBack: boolean;
}) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  const befreundet = following && followsBack;

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const ziel = !following;
            setFollowing(ziel);
            setProblem(undefined);
            startTransition(async () => {
              const result = ziel ? await follow(username) : await unfollow(username);
              if (result.error) {
                setFollowing(!ziel);
                setProblem(result.error);
              }
            });
          }}
          className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
            following ? 'border-border hover:bg-card border' : 'bg-primary text-primary-foreground'
          }`}
        >
          {following ? 'Du folgst' : 'Folgen'}
        </button>

        {befreundet ? (
          <span className="text-muted-foreground text-sm">
            Ihr folgt euch gegenseitig — ihr seht die Einträge des anderen, die nur für Freunde
            sind.
          </span>
        ) : null}

        {following && !followsBack ? (
          <span className="text-muted-foreground text-sm">Folgt dir noch nicht zurück.</span>
        ) : null}
      </div>

      <ActionNote message={problem} />
    </div>
  );
}
