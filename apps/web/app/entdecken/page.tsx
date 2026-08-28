import type { Metadata } from 'next';

import { Discover } from '@/components/discover';

export const metadata: Metadata = { title: 'Entdecken' };

/**
 * Dieselbe Seite wie die Startseite fuer Angemeldete.
 *
 * Zwei Adressen fuer einen Inhalt, weil beide gemeint sind: das Logo
 * fuehrt nach Hause, und "Entdecken" in der Leiste soll auch dann etwas
 * tun, wenn man schon zu Hause steht.
 */
export default function EntdeckenPage() {
  return <Discover />;
}
