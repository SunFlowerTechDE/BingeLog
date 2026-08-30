# Das iOS-Projekt

> Was beim Aufbau von `apps/ios` nicht offensichtlich war. Wer hier
> etwas ändert, spart sich damit ein paar Stunden.

## Bauen und starten

```bash
cd apps/ios
xcodebuild -project BingeLog.xcodeproj -scheme BingeLog \
  -destination 'platform=iOS Simulator,name=iPhone 17' build

xcrun simctl boot "iPhone 17"
xcrun simctl install "iPhone 17" \
  "$(xcodebuild -project BingeLog.xcodeproj -scheme BingeLog \
     -destination 'platform=iOS Simulator,name=iPhone 17' \
     -showBuildSettings 2>/dev/null \
     | grep -m1 BUILT_PRODUCTS_DIR | cut -d= -f2 | xargs)/BingeLog.app"
xcrun simctl launch "iPhone 17" de.sunflowertech.BingeLog
```

Für den Live-Simulator-Bereich in Claude Code muss einmalig gesetzt
sein, welches Xcode gilt — das braucht das Passwort des Rechners:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## Vier Stolpersteine

**Die Info.plist liegt unter `Config/`, nicht unter `BingeLog/`.** Der
Ordner `BingeLog/` ist eine synchronisierte Gruppe (Xcode 16,
`PBXFileSystemSynchronizedRootGroup`): alles darin wandert ins Bundle.
Eine Datei, die zugleich kopiert und als Info.plist erzeugt wird, bricht
den Build mit `Multiple commands produce …/Info.plist`.

**Eigene Info.plist-Schlüssel gehen nicht über `INFOPLIST_KEY_…`.** Das
reicht nur Schlüssel durch, die Xcode kennt. `INFOPLIST_KEY_SupabaseURL`
verschwindet still — die App startet, und die Werte fehlen. Deshalb
`INFOPLIST_FILE = Config/Info.plist` als Grundlage, während
`GENERATE_INFOPLIST_FILE = YES` den Rest weiter erzeugt.

**Eine xcconfig am Projekt reicht nicht.** Einstellungen am Target
überstimmen sie. Bundle-ID, Mindest-iOS und Swift-Version standen im
Target und gewannen; erst die xcconfig **auch** an den
Target-Konfigurationen greift. Nachgemessen: `MinimumOSVersion` blieb
bei 26.5, obwohl in der xcconfig 17.0 stand.

**`//` ist in einer xcconfig immer ein Kommentar**, auch mitten im Wert.
`https://…` wird zu `https:`. Der Ausweg ist ein leerer
Variablenausdruck zwischen den Schrägstrichen: `https:/$()/…`.

## Typisierte Fehler durch ein Protokoll

`throws(BackendError)` verliert seinen Typ, wenn die Funktion über ein
Protokoll gerufen wird — der Aufrufer sieht `any Error`. Deshalb steht
am Fangpunkt einmal `BackendError.from(error)`, statt die Typisierung
aufzugeben.

## Tests laufen lassen

```bash
xcodebuild -project BingeLog.xcodeproj -scheme BingeLog \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:BingeLogTests build-for-testing

TEST_RUNNER_LIVE_BACKEND=1 xcodebuild -project BingeLog.xcodeproj \
  -scheme BingeLog -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:BingeLogTests test-without-building
```

**`TEST_RUNNER_` ist kein Schmuck.** Eine Umgebungsvariable erreicht den
Testprozess im Simulator nur mit diesem Präfix. Ohne ihn lief die
Live-Suite als „skipped" durch, und der Lauf war trotzdem grün — die
schlechteste Sorte Testergebnis.

Bauen und Ausführen getrennt, weil `test` in einem Rutsch hier
regelmäßig ohne Fehlermeldung abbrach. Getrennt ist außerdem
nachvollziehbar, welcher der beiden Schritte klemmt.

## Eintippen im Simulator

Der `text`-Befehl geht über die Hardware-Tastatur des Macs, und die ist
deutsch belegt: **aus `@` wird `"`**. Für Adressen also die
Zwischenablage benutzen (`xcrun simctl pbcopy`) oder das Feld von Hand
füllen.

## Der Startbildschirm

Drei Sekunden beim Kaltstart, fünf Reihen Plakate, die abwechselnd nach
links und rechts ziehen (Reihe 1 links, 2 rechts, 3 links …), darüber
Logo und Name.

**Die Plakate werden nicht während der drei Sekunden geladen.** Der
erste Versuch tat das und sah falsch aus: gemessen am 31.08.2026 waren
die Reihen bei 1,8 Sekunden noch leer und bei 2,4 Sekunden voll. Jedes
Plakat erschien also für sich in der letzten Sekunde. Der Eindruck war,
jedes Bild animiere sich einzeln — dabei fuhr jede Reihe durchaus als
Block, es war zur Fahrt nur noch nichts zu sehen.

Der `URLCache` reicht dafür nicht: was darin liegt, entscheidet der
Server über seine Kopfzeilen, und geräumt wird er, wann das System will.

Also holt `SplashPosterCache` die Bilder **nach** dem Startbildschirm
und legt sie in `Caches/splash-posters` ab. `SplashFilmStore` merkt sich
dazu die Auswahl, aber nur die Filme, deren Bild danach wirklich auf der
Platte liegt. Der nächste Kaltstart liest beides synchron und zeigt alle
Plakate ab Bild eins. Zufällig bleibt es: jede Auswahl wird frisch
gezogen, nur einen Start früher.

Der allererste Start nach der Installation zeigt keine Plakate, sondern
Logo auf dunklem Grund. Dagegen hilft nichts — die Bilder liegen dann
auf keinem Gerät.

**Lizenzlage:** das ist kein Spiegel im Sinne von
`docs/legal/thetvdb-lizenz.md`. Verboten ist die Weitergabe; hier liegen
fünfzig Bilder auf dem Gerät desjenigen, der sie gerade angesehen hat,
und gehen an niemanden. `Caches` ist nicht in der Sicherung und jederzeit
vom System räumbar. Ein serverseitiger Cache-Proxy bleibt die offene
Frage, die das Lizenzpapier benennt — dieser hier ist keiner.

Die Richtung der Reihen ist durch `SplashTests/rowsAlternate()` gedeckt,
nicht durch Messung. Ein früherer Versuch, sie über zwei Screenshots zu
belegen, war ungültig: die Bilder luden zwischen den Aufnahmen noch, und
der Kantenvergleich fand jedes Mal eine andere Kante.

## Was auf dem Anmeldebildschirm noch fehlt

Der Entwurf vom 30.08.2026 zeigt „Mit Apple anmelden" und „Mit Google
anmelden". Beide sind nicht gebaut, und beide hängen an Voraussetzungen
außerhalb des Repos:

- **Apple:** braucht das bezahlte Apple Developer Program. Die Fähigkeit
  „Sign in with Apple" wird im Entwicklerportal für die App-ID
  freigeschaltet; ohne Mitgliedschaft gibt es den Schalter nicht.
- **Google:** braucht ein OAuth-Client-Paar aus der Google Cloud Console
  und den Eintrag unter _Authentication → Providers_ in Supabase.

**Der Zusammenhang ist teuer, wenn man ihn übersieht:** Apple verlangt
„Sign in with Apple", sobald eine andere Fremdanmeldung angeboten wird.
Google ohne Apple heißt Ablehnung im Review. Also entweder beide oder
keins.

Deshalb stehen die Knöpfe nicht in der App. Ein toter Knopf auf dem
Anmeldebildschirm ist schlechter als einer, der fehlt.

Das Logo ist vorläufig ein Systemzeichen (`film.circle.fill`). Eine
echte Bilddatei gehört in die Assets.

## Was nicht ins Repo gehört

`DerivedData/` und `xcuserdata/` sind ignoriert. **`Package.resolved`
nicht**: die aufgelösten Paketversionen sind Teil des Bauplans, so wie
`pnpm-lock.yaml`.
