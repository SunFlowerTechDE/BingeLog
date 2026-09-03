# Datenschutzerklärung — Quelltext

**Das hier ist die Quelle.** Die Webseite unter `/datenschutz` rendert
diesen Text; die App verlinkt auf dieselbe Seite, statt eine zweite
Fassung mitzuliefern. Zwei Fassungen laufen auseinander, und bei einem
Rechtstext merkt man das erst, wenn jemand fragt.

## Was noch fehlt

- ~~Die Angaben zum Verantwortlichen.~~ **Eingesetzt am 03.09.2026:**
  Kevin Moutin, handelnd unter SunFlower Tech, Konrad-Adenauer-Str. 21,
  42651 Solingen, `datenschutz@bingelog.eu`. Einzelunternehmen und
  Kleinunternehmer nach § 19 UStG — deshalb kein Registergericht, keine
  Registernummer und keine USt-IdNr. Das ist kein Versäumnis; es gibt
  sie nicht.

  Zwei offene Punkte dazu:

  - **Das Gewerbe ist noch nicht angemeldet** (Stand 03.09.2026). Ein
    öffentlich betriebener Dienst mit Konten und Meldeverfahren ist eine
    gewerbliche Tätigkeit; die Anmeldung gehört vor den Start.
  - **`datenschutz@bingelog.eu` muss Post annehmen.** Die Domain hat
    MX-Einträge bei mailbox.org, ob dieses Postfach existiert, ist damit
    nicht gesagt. Art. 12 Abs. 3 DSGVO setzt einen Monat zum Antworten,
    und die Frist läuft auch dann, wenn niemand hinsieht.

- **Eine juristische Prüfung.** Der Text beschreibt genau, was der Code
  tut — das ist die Grundlage, aber keine Rechtsberatung.
- **Ein Punkt gehört dabei ausdrücklich angesehen:** seit dem 03.09.2026
  überleben Bewertungen, Rezensionen und Diskussionsbeiträge die
  Kontolöschung, losgelöst vom Konto und mit „Konto gelöscht" statt
  eines Namens. Das ist eine Abwägung — Art. 17 gegen die Integrität des
  Katalogs und der Gespräche — und genau die Art Entscheidung, die eine
  Aufsichtsbehörde prüfen würde. Der Weg heraus steht im Text: einzelne
  Einträge vorher löschen oder auf Zuruf entfernen lassen.
  ~~Die Kontolöschung gibt es im Produkt noch nicht.~~ **Erledigt am
  03.09.2026.** Sie steht in Web und App unter Einstellungen → Konto und
  läuft über die Edge Function `delete-account`. Der Absatz im Text ist
  entsprechend geändert.

Ein **Impressum** gibt es seit dem 03.09.2026 ebenfalls
(`apps/web/app/impressum/`), mit denselben Angaben und dem Zusatz nach
Art. 11/12 DSA. Beide Seiten stehen in der Fusszeile und in den
App-Einstellungen unter „Rechtliches".

## Woher der Inhalt kommt

Jede Aussage ist am 03.09.2026 gegen den Code geprüft worden:

| Aussage                                         | Beleg                                             |
| ----------------------------------------------- | ------------------------------------------------- |
| Tabellen und Felder                             | `packages/db/supabase/migrations/`                |
| Buckets `avatars`/`banners`/`reports`/`imports` | dieselben Migrationen                             |
| Kein Tracker, keine Analyse                     | keine Treffer für analytics/gtag/plausible/sentry |
| Cookies nur für die Sitzung                     | `apps/web/src/lib/supabase//*`                    |
| Suchverlauf nur lokal                           | `apps/web/src/lib/search-history.ts`              |
| Bilder verlinkt, nie gespiegelt                 | ADR-002, `docs/legal/thetvdb-lizenz.md`           |
| Mailversand über Brevo                          | Supabase Auth, `smtp_host: smtp-relay.brevo.com`  |
| Captcha nur ohne Konto                          | `apps/web/src/components/turnstile.tsx`           |
| Serverstandort Frankfurt                        | Supabase-Projekt `eu-central-1`                   |
