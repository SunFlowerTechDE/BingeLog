'use client';

import { useActionState, useState, useTransition } from 'react';

import {
  saveProfile,
  saveAvatar,
  removeAvatar,
  saveBanner,
  removeBanner,
} from '@/lib/profile-actions';
import { ActionNote } from '@/components/action-note';
import { AvatarPicker, type Zuschnitt } from '@/components/avatar-picker';
import { Avatar } from '@/components/profile-parts';

/**
 * Ein Bildbereich: zeigen, austauschen, entfernen.
 *
 * Profilbild und Kopfbild verhalten sich gleich — waehlen, zuschneiden,
 * hochladen, waehrenddessen sagen was laeuft. Nur Zuschnitt und
 * Vorschau unterscheiden sich.
 */
function Bildbereich({
  titel,
  hinweis,
  vorhanden,
  speichern,
  entfernen,
  seiten,
  ausgabe,
  grenze,
  rund,
  vorschauZeigen,
}: {
  titel: string;
  hinweis: string;
  vorhanden: string | null;
  speichern: (daten: FormData) => Promise<{ error?: string; message?: string }>;
  entfernen: () => Promise<{ error?: string; message?: string }>;
  seiten: number;
  ausgabe: number;
  grenze: number;
  rund: boolean;
  vorschauZeigen: (url: string | null) => React.ReactNode;
}) {
  const [waehlt, setWaehlt] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [meldung, setMeldung] = useState<string | undefined>(undefined);
  // Sofort das neue Bild zeigen, statt auf den Server zu warten: der
  // Zuschnitt liegt ohnehin schon im Browser vor.
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gezeigt = vorschau ?? vorhanden;

  const uebernehmen = (z: Zuschnitt) => {
    setWaehlt(false);
    setVorschau(z.vorschau);
    setProblem(undefined);
    setMeldung(undefined);

    const daten = new FormData();
    daten.set('bild', z.datei, z.typ === 'image/jpeg' ? 'bild.jpg' : 'bild.webp');

    startTransition(async () => {
      const result = await speichern(daten);
      if (result.error) {
        setVorschau(null);
        setProblem(result.error);
      } else {
        setMeldung(result.message);
      }
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">{titel}</h2>
        <p className="text-muted-foreground text-xs">{hinweis}</p>
      </div>

      {waehlt ? (
        <AvatarPicker
          onReady={uebernehmen}
          onCancel={() => {
            setWaehlt(false);
          }}
          seiten={seiten}
          ausgabe={ausgabe}
          grenze={grenze}
          rund={rund}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          {vorschauZeigen(gezeigt)}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setWaehlt(true);
              }}
              className="border-border hover:bg-card rounded-md border px-3 py-2 text-sm disabled:opacity-60"
            >
              {gezeigt ? 'Anderes Bild' : 'Bild hochladen'}
            </button>

            {gezeigt ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setProblem(undefined);
                  startTransition(async () => {
                    const result = await entfernen();
                    if (result.error) setProblem(result.error);
                    else {
                      setVorschau(null);
                      setMeldung(result.message);
                    }
                  });
                }}
                className="text-muted-foreground hover:text-destructive text-sm underline underline-offset-4 disabled:opacity-60"
              >
                Entfernen
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Ohne sichtbaren Zustand haelt man einen langsamen Vorgang fuer
          keinen und klickt noch einmal. */}
      {pending ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="border-muted-foreground/40 border-t-foreground inline-block h-3.5 w-3.5 animate-spin rounded-full border-2"
          />
          Bild wird hochgeladen
        </p>
      ) : null}
      <ActionNote message={problem} />
      <ActionNote message={meldung} tone="info" />
    </section>
  );
}

export function SettingsForm({
  username,
  displayName,
  bio,
  avatarUrl,
  bannerUrl,
  watchlistPublic,
}: {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  watchlistPublic: boolean;
}) {
  const [state, action, speichert] = useActionState(saveProfile, {});

  return (
    <div className="flex flex-col gap-8">
      <Bildbereich
        titel="Kopfbild"
        hinweis="Steht ganz oben über deinem Profil und läuft nach unten ins Dunkle aus."
        vorhanden={bannerUrl}
        speichern={saveBanner}
        entfernen={removeBanner}
        seiten={8 / 3}
        ausgabe={1600}
        grenze={409600}
        rund={false}
        vorschauZeigen={(url) =>
          url ? (
            <img
              src={url}
              alt=""
              className="border-border h-24 w-64 shrink-0 rounded-md border object-cover"
            />
          ) : (
            <div className="border-border bg-card text-muted-foreground flex h-24 w-64 shrink-0 items-center justify-center rounded-md border text-xs">
              Noch kein Bild
            </div>
          )
        }
      />

      <Bildbereich
        titel="Profilbild"
        hinweis="Erscheint als Kreis, überlappt das Kopfbild."
        vorhanden={avatarUrl}
        speichern={saveAvatar}
        entfernen={removeAvatar}
        seiten={1}
        ausgabe={512}
        grenze={262144}
        rund
        vorschauZeigen={(url) =>
          url ? (
            <img
              src={url}
              alt=""
              width={96}
              height={96}
              className="h-24 w-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            <Avatar name={username} size={96} />
          )
        }
      />

      <form action={action} className="border-border flex flex-col gap-5 border-t pt-8">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Angezeigter Name</span>
          <input
            type="text"
            name="displayName"
            maxLength={40}
            defaultValue={displayName ?? ''}
            placeholder={username}
            className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
          />
          <span className="text-muted-foreground text-xs">
            Steht über deinem Profil. Leer heißt: nur @{username}.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Über dich</span>
          <textarea
            name="bio"
            rows={3}
            maxLength={300}
            defaultValue={bio ?? ''}
            className="border-border bg-card focus:ring-ring rounded-md border px-3 py-2 text-base outline-none focus:ring-2"
          />
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="watchlistPublic"
            defaultChecked={watchlistPublic}
            className="mt-1"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Watchlist öffentlich zeigen</span>
            <span className="text-muted-foreground text-xs">
              Andere sehen dann, was du dir vorgemerkt hast. Einzelne Titel kannst du auf der
              Watchlist trotzdem verbergen.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          {/* Ohne sichtbaren Zustand haelt man einen langsamen Vorgang
              fuer keinen und klickt noch einmal. */}
          <button
            type="submit"
            disabled={speichert}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {speichert ? 'Wird gespeichert' : 'Speichern'}
          </button>
          <ActionNote message={state.error} />
          <ActionNote message={state.message} tone="info" />
        </div>
      </form>
    </div>
  );
}
