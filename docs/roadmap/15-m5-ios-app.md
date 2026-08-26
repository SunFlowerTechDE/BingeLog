# M5: iOS- und iPadOS-App

**Ziel:** Native SwiftUI-App für iPhone und iPad gegen dasselbe
Supabase-Backend.

**Vorbedingung:** M4 abgeschlossen. Das Backend ist stabil und die
Datenmodelle ändern sich nicht mehr grundlegend.

**Aufwand:** 3 bis 5 Wochen.

---

## Grundsatzentscheidungen

- **Nativ, nicht Cross-Platform.** Swift und SwiftUI sind im Haus
  vorhanden (CineTime-Prototyp). Kein React Native, kein Flutter, kein
  Capacitor-Wrapper.
- **Eine Codebasis für iOS und iPadOS**, aber getrennte Layouts.
  iPad ist kein großes iPhone: `NavigationSplitView`, mehrspaltige
  Raster, Multitasking-Größen.
- **Kein Code für macOS, tvOS oder watchOS.**
- **Android kommt in M9**, nach dem App-Store-Launch. Das bedeutet
  nicht, hier Abstraktionsschichten auf Vorrat zu bauen. Es bedeutet:
  Alles, was fachlich ist, gehört ins Backend, damit der dritte Client
  es nicht nachbaut. Betrifft besonders Suchranking, Sichtbarkeitsregeln
  und das Spoiler-Gate.
- **Minimum Deployment Target:** iOS 17. Ältere Versionen kosten
  SwiftUI-Komfort, den man an dieser Stelle nicht opfern sollte.

---

## Aufgaben

### 5.1 Projektaufbau

- [ ] Xcode-Projekt unter `/apps/ios`
- [ ] Supabase Swift SDK einbinden
- [ ] Bundle ID unter dem bestehenden SunFlower-Tech-Account registrieren
- [ ] App-Name "BingeLog" in App Store Connect reservieren
      (Markenrecherche vorher, siehe `02-product.md`)
- [ ] Konfiguration über `.xcconfig`, keine Keys im Quelltext

### 5.2 Architektur

- [ ] MVVM mit `@Observable` (nicht `ObservableObject`, ab iOS 17)
- [ ] Repository-Schicht kapselt Supabase, Views kennen kein SDK
- [ ] `async/await` durchgehend, keine Completion Handler
- [ ] Fehler als typisierte `enum`, nicht als `Error`-Strings

### 5.3 Offline-Verhalten

- [ ] SwiftData als lokaler Cache für Tagebucheinträge und Watchlist
- [ ] Lesen funktioniert offline, Schreiben wird gepuffert und
      nachgereicht
- [ ] Konfliktstrategie festlegen: Last-Write-Wins ist hier vertretbar,
      da Einträge nutzereigen sind
- [ ] Plakate im Dateisystem cachen, nicht in SwiftData

### 5.4 Bildschirme

| Screen | iPhone | iPad |
|---|---|---|
| Feed | Liste | zweispaltig mit Detail |
| Suche | Vollbild-Sheet | Sidebar-Suche |
| Filmdetail | Push | Detailspalte |
| Tagebuch | Liste, nach Monat | Raster |
| Profil | Scroll | zweispaltig |
| Eintrag erfassen | Sheet | Sheet, breiter |

- [ ] Tab Bar auf iPhone, `NavigationSplitView` auf iPad
- [ ] Dynamic Type unterstützen, keine festen Schriftgrößen
- [ ] Dark Mode als Standard, Light Mode korrekt unterstützt

### 5.5 Prozedurale Karte auf iOS

**Entscheidung: SVG vom Server, lokal im Dateisystem gecacht.**

Das weicht von der ursprünglichen Empfehlung ab. Grund ist Android
(ADR-012): Bei drei Zielplattformen würde eine native
Nachimplementierung dreimal geschrieben und dreimal leicht anders
aussehen. Derselbe Film sähe auf Web, iPhone und Android unterschiedlich
aus.

- [ ] Karte einmalig vom Server laden, im Dateisystem ablegen
- [ ] Nach dem ersten Laden offline verfügbar
- [ ] Vorabladen der Karten für Watchlist und letzte Tagebucheinträge
- [ ] Snapshot-Tests gegen dieselben 10 Filme wie im Web

### 5.6 Facetten und Diskussion

- [ ] Facettenbewertung im Eintrags-Sheet, standardmäßig eingeklappt
      (gleiche Regel wie im Web, ADR-009)
- [ ] Diskussionsbereich mit denselben drei Sichtbarkeitszuständen
- [ ] **Das Gate wird nicht clientseitig nachgebaut.** Die App ruft die
      Daten ab und zeigt, was zurückkommt. Kommt nichts zurück, zeigt
      sie die Hinweisfläche. Keine lokale Prüfung "hat der Nutzer
      bewertet".
- [ ] Melden und Blockieren müssen in der App verfügbar sein. Ohne diese
      beiden Funktionen lehnt Apple die App ab.

### 5.7 iOS-Spezifika

- [ ] Sign in with Apple (Pflicht bei anderen Social Logins)
- [ ] Widgets: "Zuletzt gesehen" und "Watchlist" (optional, guter
      Retention-Hebel)
- [ ] Share Sheet: Film teilen als Link auf die Web-Seite
- [ ] Handoff zwischen iPhone, iPad und Web (optional)
- [ ] Keine Push-Notifications in dieser Ausbaustufe. Erst mit M8
      sinnvoll (Kino-Programm), vorher nur Störung.

---

## Definition of Done

- [ ] Alle Kernfunktionen aus M3 und M4 sind nativ verfügbar
- [ ] App läuft auf iPhone SE (kleinster Bildschirm) und iPad Pro 13"
      ohne Layoutfehler
- [ ] Offline: Tagebuch lesen und Eintrag erfassen funktioniert im
      Flugmodus, Sync beim Wiederverbinden
- [ ] Snapshot-Tests der generierten Karte stimmen mit dem Web überein
- [ ] Kein Absturz in einem 30-minütigen Durchlauf aller Screens

## Fallstricke

- **Nicht mit der iOS-App anfangen.** Backend und Web müssen stabil
  sein, sonst wird jede Schemaänderung dreifach nachgezogen.
- **iPad nicht als iPhone-Layout ausliefern.** Das ist ein häufiger
  Ablehnungsgrund im App-Review und sieht schlecht aus.
- **Keine Abo-Logik einbauen.** Die kommt in M7, und wenn sie zu früh
  kommt, verzögert sie das Review.
- **Karte nicht nativ nachbauen.** Siehe 5.5 und ADR-012.
- **Melde- und Blockierfunktion sind Review-Pflicht.** Fehlen sie bei
  nutzergenerierten Inhalten, gibt es keine Freigabe.
