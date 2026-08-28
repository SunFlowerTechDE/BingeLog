import type { Metadata } from 'next';

import { ResendConfirmation } from '@/components/resend-confirmation';

export const metadata: Metadata = { title: 'Postfach prüfen' };

export default async function CheckMailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ an?: string }>;
}) {
  const { an } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Schau in dein Postfach</h1>
      <p className="text-muted-foreground text-sm">
        {an ? (
          <>
            Wir haben eine Bestätigung an <span className="text-foreground">{an}</span> geschickt.
            Klick den Link darin, dann geht es weiter.
          </>
        ) : (
          'Wir haben dir eine Bestätigung geschickt. Klick den Link darin, dann geht es weiter.'
        )}
      </p>
      <p className="text-muted-foreground text-sm">Sieh auch im Spam-Ordner nach.</p>

      <ResendConfirmation email={an} />
    </main>
  );
}
