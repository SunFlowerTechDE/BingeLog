# TheTVDB: Lizenz- und Caching-Prüfung

> Ergebnis der Prüfung, die M2.2 verlangt, **bevor** das erste Bild lokal
> abgelegt wird. Geprüft am 26.08.2026 gegen die damals veröffentlichten
> Texte.
>
> **Das ist keine Rechtsberatung.** Es ist eine Zusammenfassung dessen,
> was in den Bedingungen steht, plus der daraus abgeleiteten Umsetzung.
> Der Abschnitt „Was ungeklärt bleibt" nennt, was ein Anwalt beantworten
> müsste, falls das Projekt kommerziell nennenswert wird.

Quellen: [API and Data Licensing](https://www.thetvdb.com/api-information),
[Terms of Service](https://www.thetvdb.com/tos),
[Licensed vs. User-supported API Keys](https://support.thetvdb.com/kb/faq.php?id=62)

---

## 1. Lizenzstufen

| Jahresumsatz              | Kosten                         |
| ------------------------- | ------------------------------ |
| unter 50.000 USD          | kostenlos, Attributionspflicht |
| 50.000 bis 250.000 USD    | 1.000 USD/Jahr                 |
| 250.000 bis 1.000.000 USD | 10.000 USD/Jahr                |
| über 1.000.000 USD        | Verhandlungssache              |

Bestätigt die Annahme aus ADR-002. Harte Kanten, kein Gleitpfad.
Maßgeblich ist der Umsatz von SunFlower Tech insgesamt, nicht der von
BingeLog allein.

## 2. Caching: nicht geregelt

**Befund: Die Bedingungen sagen zu Caching nichts.** Weder eine Erlaubnis
noch ein Verbot, und auch keine Pflicht, zwischengespeicherte Daten bei
Lizenzende zu löschen.

Die Roadmap vermutete, TheTVDB formuliere das anders als TMDB. Tatsächlich
formuliert TheTVDB es **gar nicht**. Das ist erlaubt-durch-Schweigen, was
schwächer ist als eine ausdrückliche Erlaubnis, aber kein Verbot.

Die Entwicklerdokumentation empfiehlt sogar ausdrücklich, selten
veränderliche Endpunkte (Genres, Sprachen, Artwork-Typen und ähnliche)
eine Woche oder länger zu cachen. Für Metadaten ist Caching also
erkennbar erwünscht. Für **Bilddateien** trifft sie keine Aussage.

## 3. Weitergabe: ausdrücklich untersagt

Die einzige Klausel, die das Speichern von Bildern wirklich berührt:

> you may not: […] license, sublicense, resell, distribute, lease, rent,
> lend, transfer, assign or otherwise dispose of the API or the Data

„distribute" ist der kritische Begriff. Die Anzeige im eigenen Produkt
ist erkennbar der vorgesehene Zweck. Bilder auf ein eigenes CDN zu kopieren
und von der eigenen Domain auszuliefern, bewegt sich näher an
„distribute the Data" als das bloße Verlinken.

## 4. Bildrechte werden nicht mitgeliefert

Der wichtigste Fund, in den Bedingungen in Großbuchstaben:

> THE TERMS OF THE API LICENSE DO NOT GIVE YOU AUTHORIZATION TO USE OR
> DISPLAY IMAGES, TRAILERS OR PROGRAMMING ASSOCIATED WITH THE API

Wer Bilder nutzt, muss die Rechte selbst bei den Rechteinhabern einholen
und vergüten. TheTVDB lizenziert den **Zugang** zu den Bildern, nicht die
**Rechte** an ihnen. Die liegen weiter bei Verleihern und Studios.

Das ist keine Besonderheit von TheTVDB. TMDB formuliert es gleichwertig,
und faktisch verfährt jede Film-App am Markt so. Es verschiebt das Risiko
aber vollständig auf uns und ist damit ein Dauerzustand, kein gelöstes
Problem.

## 5. Attributionspflicht

> Unless approved by TheTVDB, attribution with a direct link to
> TheTVDB.com must be displayed to end users viewing metadata from our API

Pflicht, nicht Höflichkeit. Ein direkter Link, für Endnutzer sichtbar.

---

## Was daraus folgt

**Bilder werden nicht gespiegelt, sondern verlinkt.** In `films.poster_url`
steht die TheTVDB-URL, ausgeliefert wird von `artworks.thetvdb.com`.

Das löst gleich vier Fragen auf einmal:

1. Die Weitergabeklausel wird nicht berührt, weil wir nichts weitergeben.
2. Es gibt kein Löschproblem bei Lizenzende — wir hören auf zu verweisen.
3. Der Fallstrick „nicht 200 GB Bilder lokal ablegen" entfällt von selbst.
4. Ändert TheTVDB ein Bild, sehen wir es sofort.

Der Preis ist eine Abhängigkeit von deren Verfügbarkeit. Genau dafür gibt
es die prozedurale Karte (ADR-004): Fällt TheTVDB aus, degradiert die App
sichtbar, statt kaputtzugehen.

**Die Attribution wird umgesetzt** auf jeder Filmdetailseite, die ein
TheTVDB-Plakat zeigt, und im Impressum. Jeweils mit direktem Link auf
thetvdb.com.

**Umsatzschwelle wird beobachtet.** Der Sprung auf 1.000 USD/Jahr ist eine
harte Kante bei 50.000 USD Konzernumsatz.

## Was ungeklärt bleibt

- **Ob ein Cache-Proxy zulässig wäre**, etwa aus Performancegründen mit
  kurzer Lebensdauer. Nicht geprüft, weil nicht gebraucht. Vor einer
  solchen Änderung neu bewerten.
- **Die Bildrechte selbst.** Wir nutzen Plakate ohne Lizenz der
  Rechteinhaber, wie der Rest des Marktes. Deutsches Recht kennt kein
  Fair-Use-Äquivalent, und §23 Abs. 1 UrhG gilt (siehe ADR-006). Das
  Risiko ist real, aber üblich und praktisch durch Löschung auf Zuruf
  handhabbar. Ab nennenswertem Umsatz anwaltlich prüfen lassen.
- **Ob die Bedingungen sich ändern.** Sie behalten sich Änderungen ohne
  Vorankündigung vor. Diese Prüfung hat ein Datum und kein Verfallsdatum.

## Prüfliste aus M2.2

- [x] Caching-Klausel gelesen — Ergebnis: nicht geregelt, Frage entfällt
      durch Verlinken statt Spiegeln
- [x] Ergebnis dokumentiert
- [ ] Attribution im Impressum umgesetzt (M6)
- [ ] Attribution auf Filmdetailseiten umgesetzt (M3)
