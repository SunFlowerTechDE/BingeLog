import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Passwort vergessen' };

export default function PasswortVergessenSeite() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Passwort vergessen</h1>
        <p className="text-muted-foreground text-sm">
          Wir schicken dir einen Link, mit dem du ein neues setzen kannst.
        </p>
      </div>

      <ResetForm />

      <Link href="/anmelden" className="text-muted-foreground text-sm">
        Zurück zur Anmeldung
      </Link>
    </main>
  );
}
