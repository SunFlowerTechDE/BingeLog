'use client';

import { useActionState, useState, useTransition } from 'react';

import { saveProfile, saveAvatar, removeAvatar } from '@/lib/profile-actions';
import { ActionNote } from '@/components/action-note';
import { AvatarPicker, type Zuschnitt } from '@/components/avatar-picker';
import { Avatar } from '@/components/profile-parts';

export function SettingsForm({
  username,
  displayName,
  bio,
  avatarUrl,
  watchlistPublic,
}: {
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  watchlistPublic: boolean;
}) {
  const [state, action, speichert] = useActionState(saveProfile, {});
  const [waehlt, setWaehlt] = useState(false);
  const [bildProblem, setBildProblem] = useState<string | undefined>(undefined);
  const [bildMeldung, setBildMeldung] = useState<string | undefined>(undefined);
  // Sofort das neue Bild zeigen, statt auf den Server zu warten: der
  // Zuschnitt liegt ohnehin schon im Browser vor.
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const uebernehmen = (z: Zuschnitt) => {
    setWaehlt(false);
    setVorschau(z.vorschau);
    setBildProblem(undefined);
    setBildMeldung(undefined);

    const daten = new FormData();
    daten.set('avatar', z.datei, 'avatar.webp');

    startTransition(async () => {
      const result = await saveAvatar(daten);
      if (result.error) {
        setVorschau(null);
        setBildProblem(result.error);
      } else {
        setBildMeldung(result.message);
      }
    });
  };

  const gezeigt = vorschau ?? avatarUrl;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">Profilbild</h2>

        {waehlt ? (
          <AvatarPicker
            onReady={uebernehmen}
            onCancel={() => {
              setWaehlt(false);
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-5">
            {gezeigt ? (
              <img
                src={gezeigt}
                alt=""
                width={96}
                height={96}
                className="h-24 w-24 shrink-0 rounded-full object-cover"
              />
            ) : (
              <Avatar name={username} size={96} />
            )}

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
                    setBildProblem(undefined);
                    startTransition(async () => {
                      const result = await removeAvatar();
                      if (result.error) setBildProblem(result.error);
                      else {
                        setVorschau(null);
                        setBildMeldung(result.message);
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

        {pending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="border-muted-foreground/40 border-t-foreground inline-block h-3.5 w-3.5 animate-spin rounded-full border-2"
            />
            Bild wird hochgeladen
          </p>
        ) : null}
        <ActionNote message={bildProblem} />
        <ActionNote message={bildMeldung} tone="info" />
      </section>

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
