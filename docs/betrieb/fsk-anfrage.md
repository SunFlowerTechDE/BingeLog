# FSK-Freigaben: Anfrage zur API

## Warum diese Quelle

Gemessen am 28.08.2026 gegen den Katalog von 155 Filmen:

| Quelle           | Abdeckung   | Haken                                  |
| ---------------- | ----------- | -------------------------------------- |
| Wikidata (P2363) | 24 %        | Titanic, Forrest Gump, Der Pate fehlen |
| TheTVDB          | 0 %         | 32 Länder, Deutschland nicht darunter  |
| TMDB             | vollständig | 149 USD/Monat, ADR-005 schließt es aus |
| OMDb             | —           | nur US-Freigaben                       |

Die FSK betreibt eine eigene Schnittstelle auf die Freigabedatenbank:
über 500.000 Titel, Altersfreigaben, Zusatzhinweise wie Gewalt oder
Drogen, dazu Kurzbegründungen. **Der Abgleich läuft über die IMDb-ID** —
genau den Schlüssel, auf den ADR-003 das Matching ohnehin festlegt.

Der Preis steht nirgends öffentlich. Es gibt nur ein unverbindliches
Angebot auf Anfrage, und davon hängt ab, ob das überhaupt in Frage kommt.

## Kontakt

Wilfried Berauer
berauer@spio-fsk.de
+49 611 77891-14

Formular: https://www.fsk.de/blog/portfolio-items/fsk-api-freigaben/

## Für das Angebotsformular

Das Formular auf der FSK-Seite fragt nach Name, E-Mail, Telefon und einer
kurzen Beschreibung des Verwendungszwecks. In dieses eine Feld gehört
alles, wonach sich der Preis richtet: Umfang, Abfragemuster, Erlöslage.

```
BingeLog ist ein Filmtagebuch für den deutschsprachigen Raum:
Nutzerinnen und Nutzer tragen gesehene Filme ein, bewerten sie und
schreiben Rezensionen. Die Seite ist noch nicht öffentlich, ein Start
ist für dieses Jahr geplant, Erlöse gibt es bislang keine.

Ich möchte auf jeder Filmseite die FSK-Freigabe anzeigen, also die
Altersstufe und je nach Vorgabe die Zusatzhinweise. Der Abgleich liefe
über die IMDb-ID, die in meinem Datenbestand ohnehin der Schlüssel ist.

Zum Umfang: Der Katalog umfasst derzeit rund 150 Filme und soll
mittelfristig auf einige zehntausend wachsen. Abgefragt würde einmal je
Film beim Aufnehmen in den Katalog, danach aus dem eigenen Bestand,
dazu ein regelmäßiger Abgleich auf geänderte Freigaben. Es entstünde
also keine Abfrage je Seitenaufruf.

Über ein Angebot sowie Spezifikation und Demo-Zugang würde ich mich
freuen.
```

Falls das Feld knapper ausfällt:

```
Filmtagebuch für den deutschsprachigen Raum, noch nicht gestartet und
ohne Erlöse. Ich möchte auf jeder Filmseite die FSK-Freigabe anzeigen,
Abgleich über die IMDb-ID. Katalog derzeit rund 150 Filme, mittelfristig
einige zehntausend. Abfrage einmal je Film beim Aufnehmen, danach aus
dem eigenen Bestand, plus regelmäßiger Abgleich auf Änderungen. Über ein
Angebot und einen Demo-Zugang würde ich mich freuen.
```

**Warum das Abfragemuster hineingehört:** Wer nicht dazusagt, dass
zwischengespeichert wird, bekommt ein Angebot für Abfragen je
Seitenaufruf kalkuliert. Das ist um Größenordnungen teurer und trifft
nicht zu.

## Entwurf für eine Mail

**Betreff:** `Anfrage FSK-API — Filmtagebuch für den deutschsprachigen Raum`

```
Sehr geehrter Herr Berauer,

ich entwickle unter dem Namen BingeLog ein Filmtagebuch für den
deutschsprachigen Raum: Nutzerinnen und Nutzer tragen gesehene Filme
ein, bewerten sie und schreiben Rezensionen. Die Seite ist noch nicht
öffentlich; ein erster Start ist für dieses Jahr geplant.

Ich möchte zu jedem Film die FSK-Freigabe anzeigen. Auf Ihrer Seite habe
ich die Schnittstelle zur Freigabedatenbank gefunden und hätte dazu
einige Fragen:

1. Was kostet der Zugang, und nach welchem Modell wird abgerechnet
   (feste Gebühr, Anzahl Abfragen, Anzahl Titel)?
2. Gibt es eine Staffel für kleine oder noch nicht erlösbringende
   Projekte?
3. Der Abgleich über die IMDb-ID passt genau zu meinem Datenmodell.
   Ist diese Zuordnung durchgängig gepflegt, oder gibt es Bestände, die
   nur über die Rentrak-ID erreichbar sind?
4. Wie darf die Freigabe dargestellt werden — reicht die Angabe der
   Altersstufe, und wie soll die Quelle genannt werden?
5. Dürfen die abgerufenen Werte zwischengespeichert werden, oder ist
   jede Anzeige ein eigener Abruf?

Über die Zugangsdaten für den Demo-Zugang und die Spezifikation würde
ich mich freuen, um den Aufwand vorher abschätzen zu können.

Mit freundlichen Grüßen
Kevin Moutin
SunFlower Tech
```

## Was mit der Antwort passiert

Kommt ein Preis heraus, der zum Budget der Roadmap passt, wird die
Freigabe wie das Artwork behandelt: ein Feld am Film, gefüllt über die
IMDb-ID, leer wenn kein Treffer. Kommt kein tragbarer Preis heraus,
bleibt es bei Wikidata und die Plakette erscheint eben nur bei einem
Viertel der Filme — nie als Schätzung, nie als Platzhalter.
