import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Anmelden' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string }>;
}) {
  const { weiter, fehler } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        {/* Die Bildmarke, wie auf dem Anmeldebildschirm der App. */}
        <Image src="/logo.png" alt="" width={40} height={40} priority className="mb-1 h-10 w-10" />
        <h1 className="text-2xl font-semibold tracking-tight">Anmelden</h1>
        <p className="text-muted-foreground text-sm">Weiter mit deinem Tagebuch.</p>
      </div>

      {fehler === 'link' ? (
        <p role="alert" className="text-destructive text-sm">
          Der Bestätigungslink ist abgelaufen oder schon benutzt. Melde dich hier an.
        </p>
      ) : null}

      <SignInForm weiter={weiter ?? ''} />

      <div className="flex flex-col gap-2">
        {/* Der Weg heraus, wenn das Passwort weg ist. Er fehlte im Web
            ganz — es gab ihn nur in der App, und der Link dort fuehrte
            auf eine Seite, die es nicht gab. */}
        <p className="text-muted-foreground text-sm">
          <Link href="/passwort-vergessen" className="text-foreground underline underline-offset-4">
            Passwort vergessen?
          </Link>
        </p>

        <p className="text-muted-foreground text-sm">
          Noch kein Konto?{' '}
          <Link href="/registrieren" className="text-foreground underline underline-offset-4">
            Registrieren
          </Link>
        </p>
      </div>
    </main>
  );
}
