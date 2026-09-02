import type { Metadata, Viewport } from 'next';

import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BingeLog',
    template: '%s — BingeLog',
  },
  description:
    'Filmtagebuch für den deutschsprachigen Raum. Eintragen, bewerten, ' +
    'darüber reden — mit Leuten, die den Film gesehen haben.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#111318',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="flex min-h-dvh flex-col antialiased">
        <Header />
        <div className="flex-1">{children}</div>
        {/* Die Fusszeile steht auf jeder Seite. Eine
            Datenschutzerklaerung, die man nur ueber die Registrierung
            findet, ist fuer alle unauffindbar, die schon ein Konto
            haben. */}
        <Footer />
      </body>
    </html>
  );
}
