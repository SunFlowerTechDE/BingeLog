import type { Metadata } from 'next';

import { getViewer } from '@/lib/session';

export const metadata: Metadata = { title: 'Tagebuch' };

export default async function DiaryPage() {
  // Unauthenticated callers never reach this: the middleware sends them
  // to /anmelden with the target in tow.
  const viewer = await getViewer();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dein Tagebuch</h1>
      <p className="text-muted-foreground text-sm">
        Hier steht bald, was du gesehen hast. Eintragen kommt als Nächstes.
      </p>
      {viewer?.username ? (
        <p className="text-muted-foreground text-sm">Angemeldet als {viewer.username}.</p>
      ) : null}
    </main>
  );
}
