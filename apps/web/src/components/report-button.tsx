'use client';

import { useEffect, useState, useTransition } from 'react';

import { fileReport, attachReportImage } from '@/lib/report-actions';
import { ActionNote } from '@/components/action-note';
import { Symbol } from '@/components/icons';

/**
 * Melden — ueberall, wo Menschen etwas hinterlassen (M4 4.7).
 *
 * Der Knopf steht immer und an jedem gemeldeten Ding: Beitrag,
 * Rezension, Profil, Liste. Auch abgemeldet. Der Digital Services Act
 * verlangt ein Verfahren, das jeder findet und benutzen kann, und "jeder"
 * schliesst ein, wer hier kein Konto hat.
 *
 * Das Formular ist ein Overlay und keine eigene Seite: wer meldet, hat
 * das Gemeldete gerade vor sich und soll es nicht verlassen muessen.
 */
const GRUENDE = [
  { wert: 'spoiler', label: 'Unmarkierter Spoiler' },
  { wert: 'harassment', label: 'Beleidigung oder Belästigung' },
  { wert: 'hate', label: 'Hass oder Hetze' },
  { wert: 'sexual', label: 'Sexueller Inhalt' },
  { wert: 'violence', label: 'Gewaltdarstellung' },
  { wert: 'spam', label: 'Spam oder Werbung' },
  { wert: 'illegal', label: 'Sonst rechtswidrig' },
  { wert: 'other', label: 'Etwas anderes' },
] as const;

export function ReportButton({
  targetKind,
  targetId,
  angemeldet,
  was,
}: {
  targetKind: 'message' | 'review' | 'profile' | 'list' | 'other';
  targetId: string;
  angemeldet: boolean;
  /** Wofuer der Knopf steht, fuer die Vorlesehilfe. */
  was: string;
}) {
  const [offen, setOffen] = useState(false);
  const [bilder, setBilder] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [fertig, setFertig] = useState<string | undefined>(undefined);
  const [laeuft, startTransition] = useTransition();

  // Escape schliesst, und solange das Overlay steht, scrollt die Seite
  // dahinter nicht weg.
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false);
    };
    document.addEventListener('keydown', taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', taste);
      document.body.style.overflow = vorher;
    };
  }, [offen]);

  const senden = (formData: FormData) => {
    setProblem(undefined);
    startTransition(async () => {
      const r = await fileReport(formData);
      if (r.error) {
        setProblem(r.error);
        return;
      }

      // Die Bilder kommen nach der Meldung: vorher gibt es keinen
      // Ordner, in den sie gehoeren.
      for (const bild of bilder) {
        const daten = new FormData();
        daten.set('bild', bild);
        const b = await attachReportImage(r.id ?? '', daten);
        if (b.error) {
          setProblem(b.error);
          break;
        }
      }

      setFertig(r.message);
      setBilder([]);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOffen(true);
          setFertig(undefined);
          setProblem(undefined);
        }}
        aria-label={`${was} melden`}
        className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 text-xs underline-offset-4 hover:underline"
      >
        <Symbol art="melden" size={13} />
        Melden
      </button>

      {offen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${was} melden`}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOffen(false);
          }}
        >
          <div className="border-border bg-background my-8 flex w-full max-w-lg flex-col gap-4 rounded-xl border p-6">
            <div className="flex items-start gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold tracking-tight">{was} melden</h2>
                <p className="text-muted-foreground text-xs">
                  Wir schauen uns jede Meldung an und sagen dir, was daraus geworden ist.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOffen(false);
                }}
                aria-label="Schließen"
                className="text-muted-foreground hover:text-foreground ml-auto"
              >
                <Symbol art="schliessen" size={18} />
              </button>
            </div>

            {fertig ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed">{fertig}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Du bekommst eine Nachricht, sobald entschieden ist — mit Begründung, und mit dem
                  Hinweis, wie du widersprechen kannst.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOffen(false);
                  }}
                  className="bg-primary text-primary-foreground self-start rounded-md px-4 py-2 text-sm font-semibold"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <form action={senden} className="flex flex-col gap-4">
                <input type="hidden" name="targetKind" value={targetKind} />
                <input type="hidden" name="targetId" value={targetId} />

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Worum geht es?</span>
                  <select
                    name="reason"
                    required
                    defaultValue=""
                    className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
                  >
                    <option value="" disabled>
                      Grund wählen
                    </option>
                    {GRUENDE.map((g) => (
                      <option key={g.wert} value={g.wert}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Was ist passiert?</span>
                  <textarea
                    name="body"
                    rows={4}
                    maxLength={2000}
                    placeholder="Beschreib den Fall. Je genauer, desto schneller geht es."
                    className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
                  />
                </label>

                {angemeldet ? null : (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Deine E-Mail-Adresse</span>
                    <input
                      type="email"
                      name="email"
                      required
                      className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
                    />
                    <span className="text-muted-foreground text-xs">
                      Nur dafür, dir die Entscheidung mitzuteilen.
                    </span>
                  </label>
                )}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">Bilder</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) => {
                      setBilder([...(e.target.files ?? [])].slice(0, 4));
                    }}
                    className="text-muted-foreground file:border-border file:bg-card text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm"
                  />
                  <span className="text-muted-foreground text-xs">
                    Bis zu vier, je höchstens 2 MB. Sieht nur die Moderation.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={laeuft}
                    className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    {laeuft ? 'Wird gesendet' : 'Melden'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOffen(false);
                    }}
                    className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
                  >
                    Abbrechen
                  </button>
                </div>

                <ActionNote message={problem} />
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
