# Nutzungsbedingungen — Quelltext

**Das hier ist die Quelle.** Die Webseite unter `/nutzungsbedingungen`
rendert diesen Text; die App verlinkt auf dieselbe Seite, wie bei der
Datenschutzerklärung und aus demselben Grund.

## Was noch fehlt

- **Eine juristische Prüfung.** Der Text beschreibt, was das Produkt tut
  und wie es gehandhabt wird — das ist die Grundlage, keine
  Rechtsberatung.
- **Zwei Klauseln, die ausdrücklich angesehen gehören:**
  - **§ 5, das Nutzungsrecht über die Kontolöschung hinaus.** Es gibt
    der Entscheidung Boden, dass Bewertungen und Rezensionen stehen
    bleiben. Ohne ihn wäre die Zusage in der Datenschutzerklärung eine
    Behauptung ohne Grundlage. Die Abwägung ist Art. 17 DSGVO gegen die
    Integrität des Katalogs; der Weg heraus steht im Text.
  - **§ 10, die Zustimmungsfiktion bei Änderungen.** Schweigen als
    Zustimmung zu werten ist in AGB gegenüber Verbrauchern heikel. Die
    Fassung hier nennt Frist, Hinweispflicht und Folge des Widerspruchs
    — ob das reicht, entscheidet nicht der Code.

## Entscheidungen, die im Text stecken

| Entscheidung                         | Warum                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mindestalter 16**                  | Art. 8 DSGVO, Deutschland hat die Grenze nicht abgesenkt. Darunter bräuchte es die Zustimmung der Eltern, und die lässt sich in diesem Produkt nicht sauber einholen. |
| **Bewertungen überleben das Konto**  | Eine Bewertung ist eine Aussage über einen Film, und der Film bleibt. Umgesetzt in `anonymise_profile()`.                                                             |
| **Kündigung durch uns mit 14 Tagen** | Ein kostenloser Dienst braucht einen Weg, sich zu trennen; die Frist gibt Zeit, die Daten mitzunehmen.                                                                |
| **Keine Verfügbarkeitszusage**       | Einzelunternehmen, kostenloser Dienst. Eine Zusage, die niemand halten kann, ist schlechter als keine.                                                                |
| **Kein Schlichtungsverfahren**       | Freiwillig, und dieselbe Aussage steht im Impressum.                                                                                                                  |

## Woher der Inhalt kommt

Jede Aussage über das Produkt ist am 03.09.2026 gegen den Code geprüft:

| Aussage                          | Beleg                                                            |
| -------------------------------- | ---------------------------------------------------------------- |
| Drei Sichtbarkeiten je Eintrag   | `entry_visibility` in `20260828090000_entry_visibility.sql`      |
| Spoilermarke ist kein Schutz     | `diary_entries.has_spoilers`, ADR-010                            |
| Melden auch ohne Konto           | `reports.reporter_email`, Turnstile am Formular                  |
| Jede Moderation wird begründet   | `account_actions.reason` ist `not null`                          |
| Löschen räumt die Beziehungen    | `anonymise_profile()` in `20260903100000_tombstone_profiles.sql` |
| Bewertungen bleiben              | derselbe Beleg, plus der Testfall in `rls.test.ts`               |
| Plakate verlinkt, nie gespiegelt | ADR-002, `docs/legal/thetvdb-lizenz.md`                          |
