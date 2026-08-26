import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getViewer } from '@/lib/session';
import { UsernameForm } from './username-form';

export const metadata: Metadata = { title: 'Name wählen' };

export default async function WelcomePage() {
  const viewer = await getViewer();

  if (!viewer) redirect('/anmelden');
  // Choosing a name is a one-time step; coming back here later is a
  // wrong turn rather than a chance to rename.
  if (viewer.username) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Wie sollen dich andere finden?</h1>
        <p className="text-muted-foreground text-sm">
          Dein Name steht in deiner Profiladresse und unter allem, was du schreibst.
        </p>
      </div>

      <UsernameForm />
    </main>
  );
}
