# Datenschutzerklärung — Quelltext

**Das hier ist die Quelle.** Die Webseite unter `/datenschutz` rendert
diesen Text; die App verlinkt auf dieselbe Seite, statt eine zweite
Fassung mitzuliefern. Zwei Fassungen laufen auseinander, und bei einem
Rechtstext merkt man das erst, wenn jemand fragt.

## Was noch fehlt

- **Die Angaben zum Verantwortlichen.** Name, Rechtsform, Anschrift und
  eine Kontaktadresse kann ich nicht erfinden; sie stehen im Text als
  `[…]` und müssen vor der Veröffentlichung eingesetzt werden.
- **Eine juristische Prüfung.** Der Text beschreibt genau, was der Code
  tut — das ist die Grundlage, aber keine Rechtsberatung.
  ~~Die Kontolöschung gibt es im Produkt noch nicht.~~ **Erledigt am
  03.09.2026.** Sie steht in Web und App unter Einstellungen → Konto und
  läuft über die Edge Function `delete-account`. Der Absatz im Text ist
  entsprechend geändert.

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
