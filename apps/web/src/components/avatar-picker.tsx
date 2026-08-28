'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Bild waehlen, zuschneiden, verkleinern — alles im Browser.
 *
 * Zwei Zuschnitte laufen hier durch: der runde fuer das Profilbild und
 * der breite Streifen fuer das Kopfbild. Beide brauchen dasselbe —
 * Ausschnitt bestimmen, herunterrechnen, unter eine Groessengrenze
 * bringen — und unterscheiden sich nur in Seitenverhaeltnis, Zielbreite
 * und Maske. Deshalb ein Bauteil mit Kennwerten und nicht zwei fast
 * gleiche.
 *
 * Wer ein Hochformat hochlaedt, soll selbst bestimmen, welcher
 * Ausschnitt das wird, statt dass die Mitte genommen wird und der Kopf
 * oben fehlt.
 *
 * Verkleinert wird **vor** dem Hochladen, nicht danach. Ein Handyfoto
 * wiegt sechs Megabyte und erscheint als Kreis von 96 Pixeln; wer das
 * ungefiltert durchlaesst, zahlt Speicher und Verkehr fuer Bildpunkte,
 * die nie jemand sieht.
 */

/**
 * Absteigende Qualitaetsstufen. Ein Foto wird bei 0.82 fast immer klein
 * genug; ein Bild mit viel Rauschen oder Text braucht manchmal weniger.
 * Lieber eine Stufe schlechter als eine Ablehnung nach dem Hochladen.
 */
const STUFEN = [0.82, 0.7, 0.6, 0.5, 0.4];

/**
 * WebP, sonst JPEG.
 *
 * `toBlob` **ignoriert eine Formatangabe, die es nicht kennt, und liefert
 * stillschweigend PNG.** Safari konnte lange kein WebP schreiben; ein PNG
 * in dieser Groesse wiegt bei einem Foto ein Vielfaches, und der Bucket
 * nimmt es ohnehin nicht. Der Rueckgabewert wird deshalb auf seinen Typ
 * geprueft und nicht geglaubt.
 *
 * Faellt WebP aus, ist JPEG der Ausweg: aelter, ueberall vorhanden, bei
 * einem Foto kaum schlechter. Ein Bild nicht hochladen zu koennen, weil
 * der Browser ein Format nicht kennt, waere die schlechteste aller
 * Antworten.
 */
async function verkleinern(
  leinwand: HTMLCanvasElement,
  grenze: number,
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
      if (blob.size <= grenze) return { blob, typ };
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
const BUEHNE = 300;

export interface Zuschnitt {
  datei: Blob;
  /** image/webp oder image/jpeg — je nachdem, was der Browser konnte. */
  typ: string;
  vorschau: string;
}

export function AvatarPicker({
  onReady,
  onCancel,
  seiten = 1,
  ausgabe = 512,
  rund = true,
  grenze = 262144,
}: {
  onReady: (z: Zuschnitt) => void;
  onCancel: () => void;
  /** Breite geteilt durch Hoehe. 1 ist das Quadrat, 8/3 der Streifen. */
  seiten?: number;
  /**
   * Zielbreite in Bildpunkten.
   *
   * 512 fuer den Kreis und nicht 256: auf hochaufloesenden Bildschirmen
   * wird ein Kreis von 96 Pixeln mit 192 gezeichnet, und Profile duerfen
   * spaeter groesser werden, ohne dass alle Bilder neu muessen.
   */
  ausgabe?: number;
  rund?: boolean;
  grenze?: number;
}) {
  const [bild, setBild] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [versatz, setVersatz] = useState({ x: 0, y: 0 });
  const [zieht, setZieht] = useState<{ x: number; y: number } | null>(null);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const leinwand = useRef<HTMLCanvasElement | null>(null);

  const buehneH = Math.round(BUEHNE / seiten);
  const ausgabeH = Math.round(ausgabe / seiten);

  /** Der Faktor, bei dem das Bild die Buehne gerade fuellt. */
  const deckung = bild ? Math.max(BUEHNE / bild.width, buehneH / bild.height) : 1;

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

    ctx.clearRect(0, 0, BUEHNE, buehneH);
    ctx.drawImage(bild, (BUEHNE - b) / 2 + versatz.x, (buehneH - h) / 2 + versatz.y, b, h);
  }, [bild, zoom, versatz, deckung, buehneH]);

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

    // Dieselbe Rechnung wie in der Vorschau, nur hochskaliert.
    const ziel = document.createElement('canvas');
    ziel.width = ausgabe;
    ziel.height = ausgabeH;
    const ctx = ziel.getContext('2d');
    if (!ctx) {
      setRechnet(false);
      return;
    }

    const massstab = ausgabe / BUEHNE;
    const f = deckung * zoom * massstab;
    const b = bild.width * f;
    const h = bild.height * f;

    ctx.drawImage(
      bild,
      (ausgabe - b) / 2 + versatz.x * massstab,
      (ausgabeH - h) / 2 + versatz.y * massstab,
      b,
      h,
    );

    const ergebnis = await verkleinern(ziel, grenze);
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
            Wird auf {ausgabe} Pixel verkleinert. Was du hochlädst, verlässt deinen Rechner erst
            danach.
          </span>
        </label>
      ) : (
        <>
          <div className="flex flex-col items-center gap-3">
            {/* So maskiert, wie es hinterher zu sehen ist — und nicht als
                das Rechteck, aus dem es geschnitten wird. */}
            <div
              style={{ width: BUEHNE, height: buehneH }}
              className={`border-border relative cursor-move overflow-hidden border ${
                rund ? 'rounded-full' : 'rounded-md'
              }`}
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
              <canvas ref={leinwand} width={BUEHNE} height={buehneH} className="touch-none" />
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
