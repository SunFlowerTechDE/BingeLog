'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The search box. Keeps the term in the URL so a result list can be
 * shared and reloaded, and debounces so typing does not fire a query per
 * keystroke (M3 3.2).
 */
export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const initial = useRef(true);

  useEffect(() => {
    // Do not re-navigate to the state the page already rendered.
    if (initial.current) {
      initial.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const trimmed = term.trim();
      // Below two characters every query matches half the catalog, so the
      // list is cleared rather than filled with noise.
      router.replace(trimmed.length >= 2 ? `/?q=${encodeURIComponent(trimmed)}` : '/', {
        scroll: false,
      });
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [term, router]);

  return (
    <input
      type="search"
      value={term}
      onChange={(event) => {
        setTerm(event.target.value);
      }}
      placeholder="Film suchen"
      aria-label="Film suchen"
      autoComplete="off"
      className="border-border bg-card focus:ring-ring w-full rounded-md border px-4 py-3
                 text-base outline-none focus:ring-2"
    />
  );
}
