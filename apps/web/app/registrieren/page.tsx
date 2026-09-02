import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';

import { SignUpForm } from './sign-up-form';

export const metadata: Metadata = { title: 'Registrieren' };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-1.5">
        {/* Die Bildmarke, wie auf dem Anmeldebildschirm der App. */}
        <Image src="/logo.png" alt="" width={40} height={40} priority className="mb-1 h-10 w-10" />
        <h1 className="text-2xl font-semibold tracking-tight">Konto anlegen</h1>
        <p className="text-muted-foreground text-sm">
          Trag ein, was du gesehen hast, und red darüber mit Leuten, die den Film auch gesehen
          haben.
        </p>
      </div>

      <SignUpForm />

      <p className="text-muted-foreground text-sm">
        Schon ein Konto?{' '}
        <Link href="/anmelden" className="text-foreground underline underline-offset-4">
          Anmelden
        </Link>
      </p>
    </main>
  );
}
