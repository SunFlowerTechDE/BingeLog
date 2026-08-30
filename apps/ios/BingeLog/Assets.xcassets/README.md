# Bildmaterial

## Was da ist

| Platz                            | Was              | Quelle                              |
| -------------------------------- | ---------------- | ----------------------------------- |
| `LogoMark.imageset`              | die Filmrolle    | `docs/betrieb/bingelog-logo-1254.png` |
| `AppIcon.appiconset/AppIcon.png` | das App-Symbol   | dasselbe Logo, auf `#0C0D10` gesetzt |

Das Original liegt bei den Betriebsunterlagen und **nicht** im
Asset-Katalog: alles darin wandert ins Bundle, und 1254 Pixel für ein
Zeichen von 72 Punkten wären Ballast auf jedem Telefon.

## Die Größen neu rechnen

```bash
cd apps/ios
for s in 140 280 420; do
  sips -Z $s ../../docs/betrieb/bingelog-logo-1254.png \
    --out "BingeLog/Assets.xcassets/LogoMark.imageset/LogoMark$([ $s = 140 ] || echo @$((s/140))x).png"
done
```

## Das App-Symbol neu bauen

Es braucht **1024 × 1024, ohne Transparenz und ohne runde Ecken** — die
setzt iOS selbst, und ein Bild, das sie mitbringt, bekommt sie doppelt.
Der Grund ist `--color-background` aus dem Web (`#0C0D10`), damit das
Symbol auf dem Homescreen zur App passt.

Erzeugt mit einem kurzen Swift-Skript über CoreGraphics; `sips` kann
nicht auf einen Grund setzen, sondern nur skalieren. Die Fassung liegt
in der Historie des Commits, der das Logo eingeführt hat.

Die Varianten für dunkel und getönt bleiben leer: iOS leitet sie selbst
ab, und ein eigenes Bild dafür wäre dreimal dasselbe.

## Farben aus der Datei, nicht aus dem Code

`template-rendering-intent` steht auf `original`. Als Schablone
gerendert verlöre das Logo sein Schwarz und wäre eine goldene Fläche.

## Was noch fehlt

Ein Schriftzug als Bilddatei. Bis dahin setzt `Wordmark.swift` das Logo
über den Namen und rendert „BingeLog" als Text — was den Vorteil hat,
dass er sich mit Dynamic Type mitskaliert.
