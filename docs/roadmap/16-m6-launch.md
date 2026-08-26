# M6: Launch

**Ziel:** App ist im App Store, Web ist öffentlich, rechtliche Pflichten
sind erfüllt.

**Vorbedingung:** M5 abgeschlossen.

**Aufwand:** 1 bis 2 Wochen, plus Wartezeit im Review.

---

## 6.1 Rechtliches

Diese Punkte sind Pflicht, nicht optional. Kein Anwaltsersatz, bei
Unsicherheit anwaltlich prüfen lassen.

- [ ] **Impressum** nach §5 DDG, auf Web und in der App erreichbar
- [ ] **Datenschutzerklärung**: Supabase als Auftragsverarbeiter, EU-Region,
      Hosting, Auth, welche Daten wie lange
- [ ] **AV-Vertrag mit Supabase** abschließen und ablegen
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** nach Art. 30 DSGVO
- [ ] **Nutzungsbedingungen** mit Regeln für nutzergenerierte Inhalte
- [ ] **Löschkonzept**: Konto löschen entfernt alle personenbezogenen
      Daten. Das ist gleichzeitig App-Store-Pflicht.
- [ ] **Datenexport** nach Art. 20 DSGVO, maschinenlesbar (JSON oder CSV)
- [ ] **TheTVDB-Attribution** auf Filmdetailseiten und im Impressum
- [ ] **Wikidata-Attribution**: CC0 verlangt sie nicht, guter Stil ist sie
      trotzdem
- [ ] **DSA-Pflichten** prüfen: Melde- und Abhilfeverfahren für
      rechtswidrige Inhalte, Kontaktstelle. Kleinstunternehmen sind von
      Teilen befreit, das Meldeverfahren ist trotzdem umzusetzen.
- [ ] **Erhöhter Aufwand durch die Filmdiskussion.** Öffentliche Threads
      sind rechtlich deutlich exponierter als reine Bewertungen.
      Nutzungsbedingungen müssen Regeln für Beiträge enthalten,
      Moderationsentscheidungen sind zu protokollieren, und eine
      Reaktionszeit auf Meldungen ist zuzusagen.

## 6.2 App Store Connect

- [ ] Privacy Nutrition Labels ausfüllen, wahrheitsgemäß
- [ ] Altersfreigabe festlegen. Nutzergenerierte Inhalte heben die
      Einstufung an.
- [ ] **Pflichten bei UGC** (häufigster Ablehnungsgrund):
  - Filterung anstößiger Inhalte
  - Melde-Mechanismus (aus M4)
  - Blockieren einzelner Nutzer
  - Kontaktmöglichkeit zum Betreiber
  - Reaktion auf Meldungen innerhalb von 24 Stunden zusagen

  Diese fünf Punkte gelten wegen der Filmdiskussion (M4) verschärft.
  Reine Sternebewertungen wären ein Grenzfall, freie Textbeiträge sind
  eindeutig UGC.
- [ ] Screenshots für iPhone und iPad, alle geforderten Größen
- [ ] App-Beschreibung, Keywords, Support-URL
- [ ] Trader Status ist bereits hinterlegt (bestehender Account)

## 6.3 TestFlight

- [ ] Interne Tests
- [ ] Externe Beta mit 20 bis 50 Testern
- [ ] **Tester gezielt suchen**: Filmforen, lokales Kinopublikum,
      Programmkino-Umfeld. Nicht Freunde und Familie, die bewerten zu
      milde.
- [ ] Feedback-Kanal einrichten
- [ ] Mindestens zwei Beta-Runden mit Nachbesserung

## 6.4 Betriebsbereitschaft

- [ ] Fehler-Monitoring (Sentry oder vergleichbar)
- [ ] Uptime-Monitoring auf die Web-App
- [ ] Datenbank-Backups geprüft, Wiederherstellung einmal getestet
- [ ] Rate Limiting auf Auth-Endpunkte
- [ ] Statusseite oder wenigstens eine Möglichkeit, Nutzer bei Ausfällen
      zu informieren

## 6.5 Web-Launch

- [ ] Domain, SSL, DNS
- [ ] `robots.txt` und Sitemap: Filmdetailseiten sind indexierbar, das
      ist der wichtigste organische Wachstumskanal
- [ ] Open Graph Tags mit Plakat, damit geteilte Links gut aussehen
- [ ] 404- und Fehlerseiten

---

## Definition of Done

- [ ] App ist im App Store verfügbar
- [ ] Web-App ist öffentlich erreichbar
- [ ] Konto löschen und Datenexport funktionieren nachweislich
- [ ] Meldeweg funktioniert Ende zu Ende
- [ ] Ein Backup wurde erfolgreich zurückgespielt

## Fallstricke

- **UGC-Anforderungen sind der häufigste Ablehnungsgrund.** Alle fünf
  Punkte aus 6.2 müssen erfüllt sein, nicht vier.
- **Kontolöschung ist App-Store-Pflicht**, nicht nur DSGVO. Fehlt sie,
  gibt es kein Review.
- **Nicht zeitgleich mit dem Abo starten.** M7 kommt nach dem ersten
  erfolgreichen Review, sonst verzögert die Abo-Prüfung den Launch.
