'use client';

import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SKRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/**
 * Das Captcha am Meldeformular fuer Nicht-Angemeldete (M4 4.7).
 *
 * Turnstile von Cloudflare und nicht reCAPTCHA: die Seite laeuft ohnehin
 * dort, es kostet nichts, und es schickt keine Daten an Google — was die
 * Datenschutzerklaerung erheblich vereinfacht.
 *
 * **Ausdrueckliches Zeichnen, nicht das automatische.** Turnstile
 * durchsucht die Seite von sich aus nur einmal, beim Laden des Skripts.
 * Dieses Widget steht in einem Overlay, das erst danach aufgeht — es
 * wurde nie gefunden, blieb leer, und jede Meldung ohne Konto scheiterte
 * an einem Token, das es gar nicht geben konnte. Nachgestellt am
 * 28.08.2026: Widget vorhanden, Feld vorhanden, Tokenlaenge 0.
 *
 * Also `render=explicit` und der Aufruf von Hand, sobald das Skript da
 * ist. Das erzeugte versteckte Feld `cf-turnstile-response` landet
 * dadurch im umgebenden Formular und ohne Zutun in der FormData.
 *
 * Ohne Konto ist das Formular ein offenes Tor mit Bild-Upload.
 * Angemeldet haengt jede Meldung an einem Konto, das man schliessen
 * kann; da braucht es kein Captcha.
 */
export function Turnstile({ siteKey }: { siteKey: string }) {
  const platz = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let abgebrochen = false;

    // Das Skript einmal in die Seite haengen.
    if (!document.querySelector('script[data-turnstile]')) {
      const skript = document.createElement('script');
      skript.src = SKRIPT;
      skript.async = true;
      skript.defer = true;
      skript.dataset.turnstile = 'true';
      document.head.appendChild(skript);
    }

    // **Nachsehen statt auf `load` warten.**
    //
    // Der Weg ueber das Ereignis sah richtig aus und zeichnete nichts:
    // je nachdem, ob das Skript neu geladen oder aus dem Zwischenspeicher
    // geholt wird, ist es schon fertig, bevor der Zuhoerer haengt — und
    // dann kommt das Ereignis nie. Von Hand aufgerufen ging `render()`
    // auf derselben Seite sofort durch, was den Verdacht bestaetigte.
    //
    // Nachsehen kennt diesen Unterschied nicht. Zehn Sekunden lang, dann
    // ist etwas anderes kaputt und ein weiterer Versuch hilft nicht.
    const bis = Date.now() + 10_000;
    const uhr = setInterval(() => {
      if (abgebrochen) return;
      if (!window.turnstile || !platz.current) {
        if (Date.now() > bis) clearInterval(uhr);
        return;
      }
      clearInterval(uhr);
      if (platz.current.childElementCount > 0) return;

      widgetId = window.turnstile.render(platz.current, {
        sitekey: siteKey,
        theme: 'dark',
        language: 'de',
      });
    }, 120);

    return () => {
      abgebrochen = true;
      clearInterval(uhr);

      // **`remove()` wirft, wenn das Widget schon weg ist.**
      //
      // Genau das passierte nach einer erfolgreichen Meldung: die
      // Dankeschoen-Ansicht ersetzt das Formular, React raeumt den
      // Knoten ab, und dieses Aufraeumen laeuft danach. Turnstile findet
      // sein Widget nicht mehr und wirft — ein Fehler im Aufraeumen
      // reisst den ganzen Baum mit, und der Nutzer sah "A server error
      // occurred", obwohl seine Meldung gespeichert war.
      //
      // Die schlimmste Sorte Fehler: sieht kaputt aus, hat funktioniert.
      // Wer sie sieht, meldet ein zweites Mal.
      try {
        if (widgetId !== null) window.turnstile?.remove(widgetId);
      } catch {
        // Schon weg. Nichts zu tun und nichts zu melden.
      }
    };
  }, [siteKey]);

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={platz} />
      <span className="text-muted-foreground text-xs">
        Kurze Prüfung, damit hier keine Maschinen melden.
      </span>
    </div>
  );
}
