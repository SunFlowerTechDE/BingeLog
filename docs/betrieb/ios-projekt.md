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

## Was nicht ins Repo gehört

`DerivedData/` und `xcuserdata/` sind ignoriert. **`Package.resolved`
nicht**: die aufgelösten Paketversionen sind Teil des Bauplans, so wie
`pnpm-lock.yaml`.
