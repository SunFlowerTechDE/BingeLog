'use client';

import { useState, useTransition } from 'react';

import { blockUser, unblockUser } from '@/lib/block-actions';
import { ActionNote } from '@/components/action-note';

/**
 * Jemanden blockieren oder wieder freigeben.
 *
 * Ohne Rueckfrage beim Blockieren: es tut niemandem weh und laesst sich
 * mit demselben Knopf zuruecknehmen. Ein Bestaetigungsdialog waere eine
 * Huerde vor etwas Harmlosem.
 */
export function BlockButton({ username, blockiert }: { username: string; blockiert: boolean }) {
  const [an, setAn] = useState(blockiert);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={laeuft}
        onClick={() => {
          const naechster = !an;
          setAn(naechster);
          setProblem(undefined);
          startTransition(async () => {
            const r = naechster ? await blockUser(username) : await unblockUser(username);
            if (r.error) {
              setAn(!naechster);
              setProblem(r.error);
            }
          });
        }}
        className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4 disabled:opacity-60"
      >
        {an ? 'Blockierung aufheben' : 'Blockieren'}
      </button>
      <ActionNote message={problem} />
    </span>
  );
}
