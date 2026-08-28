'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Bild waehlen, zuschneiden, verkleinern — alles im Browser.
 *
 * Der Zuschnitt ist quadratisch, weil das Bild als Kreis erscheint. Wer
 * ein Hochformat hochlaedt, soll selbst bestimmen, welcher Ausschnitt
 * das wird, statt dass die Mitte genommen wird und der Kopf oben fehlt.
 *
 * Verkleinert wird **vor** dem Hochladen, nicht danach. Ein Handyfoto
 * wiegt sechs Megabyte und erscheint als Kreis von 96 Pixeln; wer das
 * ungefiltert durchlaesst, zahlt Speicher und Verkehr fuer Bildpunkte,
 * die nie jemand sieht. Heraus kommen 512 Pixel im Quadrat, ueblicherweise
 * um die 40 KB — als WebP, und wo der Browser das nicht schreiben kann,
 * als JPEG.
 *
 * 512 und nicht 256: auf hochaufloesenden Bildschirmen wird ein Kreis
 * von 96 Pixeln mit 192 gezeichnet, und Profile duerfen spaeter groesser
 * werden, ohne dass alle Bilder neu muessen.
 */

const AUSGABE = 512;

/**
 * Absteigende Qualitaetsstufen. Ein Foto wird bei 0.82 fast immer klein
 * genug; ein Bild mit viel Rauschen oder Text braucht manchmal weniger.
 * Lieber eine Stufe schlechter als eine Ablehnung nach dem Hochladen.
 */
const STUFEN = [0.82, 0.7, 0.6, 0.5, 0.4];

/** Was der Bucket annimmt. Hier schon prüfen, nicht erst dort. */
const GRENZE = 262144;

/**
 * WebP, sonst JPEG.
 *
 * `toBlob` **ignoriert eine Formatangabe, die es nicht kennt, und liefert
 * stillschweigend PNG.** Safari konnte lange kein WebP schreiben; ein PNG
 * mit 512 Pixeln wiegt bei einem Foto ein halbes Megabyte, und der
 * Bucket nimmt es ohnehin nicht. Der Rueckgabewert wird deshalb auf
 * seinen Typ geprueft und nicht geglaubt.
 *
 * Faellt WebP aus, ist JPEG der Ausweg: aelter, ueberall vorhanden, bei
 * einem Portraet in diesem Format kaum schlechter. Ein Profilbild nicht
 * hochladen zu koennen, weil der Browser ein Format nicht kennt, waere
 * die schlechteste aller Antworten.
 */
async function verkleinern(
  leinwand: HTMLCanvasElement,
): Promise<{ blob: Blob; typ: string } | { fehler: string }> {
  for (const typ of ['image/webp', 'image/jpeg']) {
    let kann = true;

    for (const guete of STUFEN) {
      const blob = await new Promise<Blob | null>((auf) => {
        leinwand.toBlob(auf, typ, guete);
      });

      if (blob?.type !== typ) {
        // Dieses Format kann der Browser nicht. Naechstes versuchen,
        // statt fuenfmal dasselbe PNG zu erzeugen.
        kann = false;
        break;
      }
      if (blob.size <= GRENZE) return { blob, typ };
    }

    if (kann) {
      return {
        fehler:
          'Das Bild ließ sich nicht klein genug rechnen. Versuch einen engeren Ausschnitt ' +
          'oder ein anderes Bild.',
      };
    }
  }

  return {
    fehler:
      'Dein Browser kann das Bild nicht umwandeln. Mit einem aktuellen Chrome, Firefox oder ' +
      'Safari sollte es gehen.',
  };
}

/** Wieviel Breite die Vorschau hat. Der Zuschnitt rechnet in diesem Raum. */
const BUEHNE = 260;

export interface Zuschnitt {
  datei: Blob;
  /** image/webp oder image/jpeg — je nachdem, was der Browser konnte. */
  typ: string;
  vorschau: string;
}

export function AvatarPicker({
  onReady,
  onCancel,
}: {
  onReady: (z: Zuschnitt) => void;
  onCancel: () => void;
}) {
  const [bild, setBild] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [versatz, setVersatz] = useState({ x: 0, y: 0 });
  const [zieht, setZieht] = useState<{ x: number; y: number } | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const leinwand = useRef<HTMLCanvasElement | null>(null);

  /** Der Faktor, bei dem das Bild die Buehne gerade fuellt. */
  const deckung = bild ? Math.max(BUEHNE / bild.width, BUEHNE / bild.height) : 1;

  // Zeichnen, sooft sich etwas bewegt. Ein Canvas statt CSS, weil daraus
  // am Ende dieselbe Rechnung die Datei erzeugt — was man sieht, ist
  // was gespeichert wird.
  useEffect(() => {
    const c = leinwand.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !bild) return;

    const f = deckung * zoom;
    const b = bild.width * f;
    const h = bild.height * f;

    ctx.clearRect(0, 0, BUEHNE, BUEHNE);
    ctx.drawImage(bild, (BUEHNE - b) / 2 + versatz.x, (BUEHNE - h) / 2 + versatz.y, b, h);
  }, [bild, zoom, versatz, deckung]);

  const laden = (datei: File) => {
    setProblem(undefined);

    if (!datei.type.startsWith('image/')) {
      setProblem('Das ist kein Bild.');
      return;
    }

    const url = URL.createObjectURL(datei);
    const el = new Image();
    el.onload = () => {
      setBild(el);
      setZoom(1);
      setVersatz({ x: 0, y: 0 });
    };
    el.onerror = () => {
      setProblem('Das Bild lässt sich nicht öffnen.');
      URL.revokeObjectURL(url);
    };
    el.src = url;
  };

  const [rechnet, setRechnet] = useState(false);

  const fertigstellen = async () => {
    if (!bild) return;
    setRechnet(true);
    setProblem(undefined);

    // Dieselbe Rechnung wie in der Vorschau, nur auf 512 hochskaliert.
    const ziel = document.createElement('canvas');
    ziel.width = AUSGABE;
    ziel.height = AUSGABE;
    const ctx = ziel.getContext('2d');
    if (!ctx) {
      setRechnet(false);
      return;
    }

    const massstab = AUSGABE / BUEHNE;
    const f = deckung * zoom * massstab;
    const b = bild.width * f;
    const h = bild.height * f;

    ctx.drawImage(
      bild,
      (AUSGABE - b) / 2 + versatz.x * massstab,
      (AUSGABE - h) / 2 + versatz.y * massstab,
      b,
      h,
    );

    const ergebnis = await verkleinern(ziel);
    setRechnet(false);

    if ('fehler' in ergebnis) {
      setProblem(ergebnis.fehler);
      return;
    }

    onReady({
      datei: ergebnis.blob,
      typ: ergebnis.typ,
      vorschau: URL.createObjectURL(ergebnis.blob),
    });
  };

  return (
    <div className="border-border bg-card/40 flex flex-col gap-4 rounded-lg border p-5">
      {!bild ? (
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Bild auswählen</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const datei = event.target.files?.[0];
              if (datei) laden(datei);
            }}
            className="text-muted-foreground file:border-border file:bg-card text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
          />
          <span className="text-muted-foreground text-xs">
            Wird auf 512 Pixel verkleinert. Was du hochlädst, verlässt deinen Rechner erst danach.
          </span>
        </label>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            {/* Rund maskiert, damit man sieht, was hinterher zu sehen ist —
                und nicht das Quadrat, aus dem es geschnitten wird. */}
            <div
              style={{ width: BUEHNE, height: BUEHNE }}
              className="border-border relative cursor-move overflow-hidden rounded-full border"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setZieht({ x: e.clientX - versatz.x, y: e.clientY - versatz.y });
              }}
              onPointerMove={(e) => {
                if (!zieht) return;
                setVersatz({ x: e.clientX - zieht.x, y: e.clientY - zieht.y });
              }}
              onPointerUp={() => {
                setZieht(null);
              }}
            >
              <canvas ref={leinwand} width={BUEHNE} height={BUEHNE} className="touch-none" />
            </div>

            <label className="flex w-full max-w-xs items-center gap-3 text-sm">
              <span className="text-muted-foreground text-xs">Größe</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => {
                  setZoom(Number(e.target.value));
                }}
                className="flex-1"
              />
            </label>

            <p className="text-muted-foreground text-xs">Zum Verschieben ins Bild fassen.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={rechnet}
              onClick={() => {
                void fertigstellen();
              }}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {rechnet ? 'Wird verkleinert' : 'Übernehmen'}
            </button>
            <button
              type="button"
              onClick={() => {
                setBild(null);
              }}
              className="border-border hover:bg-card rounded-md border px-3 py-2 text-sm"
            >
              Anderes Bild
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              Abbrechen
            </button>
          </div>
        </>
      )}

      {problem ? <p className="text-destructive text-sm">{problem}</p> : null}
    </div>
  );
}
