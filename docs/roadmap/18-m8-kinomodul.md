# M8: Kinomodul (B2B)

**Ziel:** Kinos zahlen für Publikumsbindung. Das ist der eigentliche
Tragfähigkeitshebel des Projekts.

**Vorbedingung:** M7 abgeschlossen, App läuft im Betrieb, es gibt eine
nutzbare Nutzerbasis in mindestens einer Region.

**Aufwand:** offen. Nicht vor einem stabilen Betrieb beginnen.

---

## Warum dieses Modul existiert

Rechnerischer Vergleich für dasselbe Umsatzziel von 1.000 € im Monat:

| Weg                       | Nötig                             |
| ------------------------- | --------------------------------- |
| Werbung                   | ca. 4.250 monatlich aktive Nutzer |
| Supporter-Abo (3 €/Monat) | ca. 336 zahlende Nutzer           |
| **Kinos (59 €/Monat)**    | **17 Kinos**                      |

Marktgröße Deutschland (FFA, Ende 2025): 947 Standorte, 1.651 Kinos,
4.757 Leinwände. Abzüglich Kettenhäuser bleiben grob 1.000 bis 1.200
adressierbare Spielstätten. 17 Kinos entsprechen etwa 1,5 Prozent
Marktdurchdringung.

**Zweiter Effekt:** Ein Kino besitzt legales Werbematerial vom Verleih
für seine laufenden Filme. Der Kinopartner löst damit die Plakatfrage
für genau den Katalogausschnitt, der am meisten genutzt wird.

---

## Produktumfang

### Für den Zuschauer (kostenlos)

- [ ] Kinoprofil mit Spielplan
- [ ] Filter "läuft gerade in meiner Nähe"
- [ ] Push-Benachrichtigung, wenn ein Film von der Watchlist in einem
      gefolgten Kino läuft. **Das ist der Kernnutzen für beide Seiten.**
- [ ] Programmreihen und Specials

### Für das Kino (kostenpflichtig)

- [ ] Redaktionsoberfläche für Spielplan und Reihen
- [ ] Push-Kampagnen an Nutzer, die dem Kino folgen
- [ ] Auswertung des eigenen Publikums, aggregiert

---

## Datenschutz beim Auswertungsteil

Das ist der einzige zulässige Weg, Publikumsdaten zu verwerten.

- Der Betreiber ist **Auftragsverarbeiter nach Art. 28 DSGVO** für das
  Kino, nicht Datenhändler
- Auswertungen ausschließlich **aggregiert**, mit Mindestgruppengröße
- **Keine Weitergabe an Dritte**, keine Verleihe, keine Studios
- AV-Vertrag mit jedem Kino
- Kein Verkauf von Rohdaten, unter keinen Umständen (ADR-007)

---

## Preisstaffel

| Tarif  | Preis/Monat | Umfang                                  |
| ------ | ----------- | --------------------------------------- |
| Basis  | 29 €        | Kinoprofil, Spielplan                   |
| Plus   | 59 €        | plus Push-Kampagnen, Reihen, Auswertung |
| Bundle | 99 €        | plus CineTime-Schichtplanung            |

Das Bundle ist der interessanteste Weg: Derselbe Mandant kauft ein
zweites Modul, statt dass ein neuer Markt ein erstes kauft.

---

## Technisches

- [ ] **Hier** kommt `org_id` ins Spiel, nicht vorher. Neue Tabellen für
      Kinos, Spielstätten, Vorstellungen, Kinonutzer.
- [ ] RLS auf `org_id` von der ersten Migration dieses Moduls an
- [ ] Spielplan-Import: manuelle Eingabe zuerst. Schnittstellen zu
      Kinokassensystemen erst, wenn ein zahlender Kunde es verlangt.
- [ ] Push-Infrastruktur (APNs). Erst hier sinnvoll, vorher nur Störung.

---

## Vertrieb

- [ ] Erstes Kino aus dem direkten Umfeld gewinnen, als Pilot
- [ ] Referenz aufbauen, bevor breit angesprochen wird
- [ ] Kanäle: Verbände der Filmkunsttheater, Filmkunstmessen, direkte
      Ansprache von Programmkinos
- [ ] Preis am Pilotkunden validieren, bevor die Staffel festgeschrieben
      wird

---

## Definition of Done

- [ ] Ein zahlendes Pilotkino nutzt das Modul im Alltag
- [ ] Push bei Watchlist-Treffer funktioniert und wird angenommen
- [ ] AV-Vertrag und Auswertungslogik sind geprüft
- [ ] Die Fixkosten des Gesamtprojekts sind gedeckt

## Fallstricke

- **Nicht vor einer Nutzerbasis starten.** Ein Kino zahlt für Reichweite.
  Ohne Nutzer in seiner Stadt ist das Modul wertlos.
- **Nicht mit Kassenschnittstellen anfangen.** Manuelle Eingabe reicht
  für den Pilotkunden und kostet Wochen weniger.
- **Umsatzschwelle TheTVDB im Auge behalten.** Ab 50.000 USD
  Gesamtumsatz von SunFlower Tech greift die nächste Lizenzstufe.
