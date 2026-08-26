# Roadmap: BingeLog (SunFlower Tech)

> Einstiegspunkt. Lies diese Datei zuerst, dann `01-decisions.md`
> und `02-product.md`.
> Die Meilensteine `10-` bis `19-` sind in Reihenfolge zu bearbeiten.

## Was gebaut wird

**BingeLog** ist eine Filmtagebuch- und Bewertungsplattform für den
deutschsprachigen Markt, mit Schwerpunkt auf Kinofilmen und lokalen
Programmkinos.

**Plattformen in Reihenfolge:**

1. Web (Next.js, responsive, Desktop und Mobile)
2. iOS (nativ, SwiftUI)
3. iPadOS (nativ, gleiche Codebasis wie iOS, eigene Layouts)
4. **Android (nativ, Kotlin/Compose) ab M9, nachdem Version 1 im
   App Store ist**

**Nicht in dieser Roadmap:** macOS, tvOS, watchOS.

Produktbeschreibung, Zielgruppe und Haltung stehen in `02-product.md`.
Diese Datei bleibt technisch.

## Kernfunktionen

| Funktion | Meilenstein |
|---|---|
| Suche, Filmdetail, Sternebewertung | M3 |
| **Facettenbewertung** (Schauspiel, Story, Setting u. a.) | M3 |
| Tagebuch, Listen, Profile | M4 |
| **Nutzern folgen** und Feed | M4 |
| **Spoilergeschützte Filmdiskussion** | M4 |
| Native iOS/iPadOS-App | M5 |
| Native Android-App | M9 |

## Technischer Stack

| Bereich | Technologie |
|---|---|
| Datenbank | PostgreSQL via Supabase (hosted) |
| Auth | Supabase Auth |
| Web | Next.js 16, TypeScript strict, Tailwind, shadcn/ui |
| iOS/iPadOS | Swift, SwiftUI, async/await |
| Android | Kotlin, Jetpack Compose |
| Volltextsuche | PostgreSQL `pg_trgm` + eigenes Ranking |
| Import-Pipeline | Python oder Node, offline, nicht im App-Deployment |
| Metadaten | Wikidata (CC0) |
| Artwork | TheTVDB v4 API + prozedurale Fallback-Karte |

## Konventionen

- **Code auf Englisch, UI-Texte auf Deutsch.** Gilt für Bezeichner,
  Kommentare, Commit-Messages, Tabellen- und Spaltennamen.
- **Metrische Einheiten.**
- **RLS ab der ersten Migration.** Keine Tabelle ohne Row Level Security.
- **Keine Business-Logik in Client-Komponenten.**
- **Sicherheitsrelevante Regeln werden in der Datenbank durchgesetzt,
  nie in der UI.** Betrifft besonders das Spoiler-Gate (ADR-010).
- Zeitzonen über `date-fns-tz` (Web), `Foundation.TimeZone` (Swift),
  `kotlinx-datetime` (Android).

## Meilensteine

| # | Datei | Inhalt | Aufwand grob |
|---|---|---|---|
| M0 | `10-m0-fundament.md` | Repo, Supabase, Schema, RLS | 3 bis 4 Tage |
| M1 | `11-m1-datenpipeline.md` | Wikidata-Import nach Postgres | 3 bis 5 Tage |
| M2 | `12-m2-poster-system.md` | Prozedurale Karte + TheTVDB-Layer | 3 bis 4 Tage |
| M3 | `13-m3-web-kern.md` | Auth, Suche, Filmdetail, Bewertung | 2 bis 3 Wochen |
| M4 | `14-m4-diary-social.md` | Tagebuch, Follows, Listen, Diskussion | 2 bis 3 Wochen |
| M5 | `15-m5-ios-app.md` | SwiftUI-App für iOS und iPadOS | 3 bis 5 Wochen |
| M6 | `16-m6-launch.md` | Recht, TestFlight, App Store | 1 bis 2 Wochen |
| M7 | `17-m7-monetarisierung.md` | Supporter-Abo | 1 Woche |
| M9 | `19-m9-android.md` | Native Android-App | 3 bis 5 Wochen |
| M8 | `18-m8-kinomodul.md` | Kino-B2B-Modul (optional) | offen |

Aufwände gelten für Teilzeitarbeit neben einem Hauptjob und sind grobe
Hausnummern, keine Zusagen.

## Kritischer Pfad

```
M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6 -> M9 (Android)
                                     \
                                      -> M7 (Supporter-Abo)

M8 (Kino) ist unabhängig und setzt laufenden Betrieb voraus.
```

**M9 startet erst, wenn Version 1 im App Store live ist.** Grund: Jede
Schemaänderung müsste sonst dreifach nachgezogen werden, und der
App-Store-Review deckt Fehler auf, die man nicht zweimal machen will.

M2 ist bewusst **vor** M3 eingeplant. Die prozedurale Karte muss stehen,
bevor irgendeine UI gebaut wird, sonst hängt die gesamte Oberfläche
implizit an TheTVDB.

## Laufende Kosten im Zielzustand

| Posten | Monat |
|---|---|
| Supabase Pro | ca. 23 € |
| Apple Developer Program | ca. 8 € (99 USD/Jahr) |
| Google Play Developer | 0 € (25 USD einmalig, ab M9) |
| Domain, Mail | ca. 4 € |
| TheTVDB | 0 € (ADR-002) |
| **Summe** | **ca. 35 €** |

## Was diese Roadmap nicht enthält

- Kein Streaming-Verfügbarkeitsdienst (lizenzpflichtig)
- Keine Werbung (ADR-007)
- Kein Verkauf von Nutzerdaten (ADR-007)
