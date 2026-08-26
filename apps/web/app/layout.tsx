import type { Metadata, Viewport } from 'next';

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
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
