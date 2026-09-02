import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { getViewer } from '@/lib/session';
import { NewPasswordForm } from './new-password-form';

export const metadata: Metadata = { title: 'Neues Passwort' };

/**
 * Ein neues Passwort setzen.
 *
 * Erreichbar nur mit einer Sitzung, und die entsteht hier ausschliesslich
 * ueber den Link aus der Mail (`/auth/neues-passwort`). Wer direkt
 * hierherkommt, ohne angemeldet zu sein, hat den Nachweis nicht
 * erbracht.
 */
export default async function NeuesPasswortSeite() {
  const viewer = await getViewer();
  if (!viewer) redirect('/anmelden?fehler=link');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Neues Passwort</h1>
        <p className="text-muted-foreground text-sm">
          Danach bist du angemeldet — auf diesem Gerät und in der App.
        </p>
      </div>

      <NewPasswordForm />
    </main>
  );
}
