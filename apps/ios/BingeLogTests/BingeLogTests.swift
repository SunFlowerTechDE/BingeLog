import Foundation
import SwiftUI
import Testing
import UIKit

@testable import BingeLog

/// Was ohne Netz prüfbar ist.
@Suite("Modelle und Fehler")
struct ModelTests {
    /// Die Feldnamen der Datenbank kommen richtig an.
    ///
    /// Geht diese Übersetzung schief, ist der Film leer und die Ursache
    /// steht in keiner Fehlermeldung — genau deshalb ein Test.
    @Test("Ein Film aus der Datenbankantwort")
    func decodesFilm() throws {
        let json = Data(
            """
            {
              "wikidata_id": "Q125772",
              "title_de": "Solaris",
              "title_original": "Солярис",
              "release_year": 1972,
              "poster_source": "tvdb",
              "poster_url": "https://artworks.thetvdb.com/x.jpg"
            }
            """.utf8)

        let film = try JSONDecoder().decode(Film.self, from: json)

        #expect(film.wikidataID == "Q125772")
        #expect(film.title == "Solaris")
        #expect(film.releaseYear == 1972)
    }

    /// Ohne deutschen Titel steht der Originaltitel da, nicht nichts.
    @Test("Titel fällt auf das Original zurück")
    func fallsBackToOriginalTitle() throws {
        let json = Data(
            """
            {"wikidata_id":"Q1","title_de":null,"title_original":"Alien",
             "release_year":1979,"poster_source":null,"poster_url":null}
            """.utf8)

        let film = try JSONDecoder().decode(Film.self, from: json)
        #expect(film.title == "Alien")
    }

    /// Ohne echtes Plakat die prozedurale Karte vom eigenen Server.
    ///
    /// Nicht nachgebaut: bei drei Plattformen sähe derselbe Film sonst
    /// dreimal anders aus (ADR-012, M5 5.5).
    @Test("Plakatadresse: TheTVDB verlinkt, sonst die eigene Karte")
    func picksPosterAddress() throws {
        let base = URL(string: "https://bingelog.eu")!

        let withArtwork = Film(
            wikidataID: "Q1", titleDE: nil, titleOriginal: "A", releaseYear: nil,
            posterSource: "tvdb", posterURL: "https://artworks.thetvdb.com/a.jpg"
        )
        #expect(withArtwork.posterAddress(webBase: base)?.host() == "artworks.thetvdb.com")

        let withoutArtwork = Film(
            wikidataID: "Q2", titleDE: nil, titleOriginal: "B", releaseYear: nil,
            posterSource: nil, posterURL: nil
        )
        #expect(withoutArtwork.posterAddress(webBase: base)?.path() == "/poster/Q2")
    }

    /// Falsche Zugangsdaten bekommen einen eigenen Fall, keinen Text.
    @Test("Fehler werden benannt, nicht verglichen")
    func namesErrors() {
        struct Foreign: Error { let message = "Invalid login credentials" }

        #expect(BackendError.from(Foreign()) == .invalidCredentials)
        #expect(BackendError.from(URLError(.notConnectedToInternet)) == .unreachable)
        #expect(BackendError.from(BackendError.notSignedIn) == .notSignedIn)
    }
}

/// Die Regeln für Benutzernamen.
///
/// Dieselben wie im Web, und dieselben Testfälle: der Name ist die
/// Adresse eines Profils, und zwei Clients, die ihn verschieden
/// säubern, ergeben zwei Nutzer, die sich für denselben halten.
@Suite("Benutzernamen")
struct UsernameTests {
    @Test("Großbuchstaben werden klein, Unerlaubtes fällt weg")
    func sanitises() {
        #expect(Username.sanitise("BingeLog") == "bingelog")
        #expect(Username.sanitise("Bing eLog! ÄÖÜ") == "bing_elog_")
        #expect(Username.sanitise("  kevin  ") == "_kevin_")
    }

    @Test("Nie länger als zwanzig Zeichen")
    func trimsToTwenty() {
        let long = String(repeating: "a", count: 40)
        #expect(Username.sanitise(long).count == 20)
    }

    @Test("Das Muster nimmt an, was es soll")
    func matchesPattern() {
        for good in ["abc", "kvn_undso", "a1_2"] {
            #expect((try? Username.pattern.wholeMatch(in: good)) != nil, "\(good) sollte passen")
        }
        for bad in ["ab", "Abc", "mit-strich", String(repeating: "a", count: 21)] {
            #expect((try? Username.pattern.wholeMatch(in: bad)) == nil, "\(bad) sollte nicht passen")
        }
    }
}

/// Der Startbildschirm.
@Suite("Startbildschirm")
struct SplashTests {
    /// Benachbarte Reihen ziehen in verschiedene Richtungen.
    @Test("Reihen wandern abwechselnd nach links und rechts")
    func rowsAlternate() {
        let travel: CGFloat = 60

        for row in 0..<6 {
            let start = SplashView.offset(forRow: row, travel: travel, hasStarted: false)
            let end = SplashView.offset(forRow: row, travel: travel, hasStarted: true)

            // Jede Reihe bewegt sich überhaupt …
            #expect(start != end, "Reihe \(row) steht still")
            // … und die Nachbarreihe in die andere Richtung.
            let next = SplashView.offset(forRow: row + 1, travel: travel, hasStarted: true)
            #expect(
                (end < 0) != (next < 0),
                "Reihen \(row) und \(row + 1) ziehen in dieselbe Richtung")
        }

        // Und die geraden nach links, wie beschrieben.
        #expect(SplashView.offset(forRow: 0, travel: travel, hasStarted: true) < 0)
        #expect(SplashView.offset(forRow: 1, travel: travel, hasStarted: true) > 0)
    }

    /// Die Wand deckt den Bildschirm — auch am äußersten Punkt der Fahrt.
    ///
    /// Das ist die Zusicherung, die bei fester Plakatbreite auf dem iPad
    /// gebrochen war: dort blieb ein schwarzer Rand, und beim Fahren
    /// schob er sich ins Bild.
    @Test("Die Plakatwand deckt jeden Bildschirm, auch beim Fahren")
    func wallCoversTheScreen() {
        let spacing: CGFloat = 8
        let travel: CGFloat = 240
        let rowCount = 5
        let perRow = 10

        let screens: [CGSize] = [
            CGSize(width: 402, height: 874),  // iPhone 17
            CGSize(width: 375, height: 812),  // das schmalste noch unterstützte
            CGSize(width: 1024, height: 1366),  // iPad hoch
            CGSize(width: 1366, height: 1024),  // iPad quer
        ]

        for screen in screens {
            let width = SplashView.posterWidth(
                in: screen, rowCount: rowCount, perRow: perRow,
                spacing: spacing, travel: travel)

            let rowWidth = CGFloat(perRow) * width + CGFloat(perRow - 1) * spacing
            let overhang = (rowWidth - screen.width) / 2
            #expect(
                overhang >= travel,
                "\(screen): der Überstand \(overhang) trägt die Fahrt von \(travel) nicht")

            let wallHeight = CGFloat(rowCount) * width * 1.5 + CGFloat(rowCount - 1) * spacing
            #expect(
                wallHeight >= screen.height,
                "\(screen): die Wand ist mit \(wallHeight) nicht hoch genug")
        }
    }
}

/// Die Suche.
@Suite("Suche")
struct SearchYearTests {
    /// Das Feld nimmt nur vier Ziffern.
    @Test("Das Jahresfeld lässt nur vier Ziffern durch")
    func yearFieldAcceptsFourDigits() {
        #expect(SearchViewModel.onlyDigits("1999") == "1999")
        #expect(SearchViewModel.onlyDigits("19a9") == "199")
        #expect(SearchViewModel.onlyDigits("19999") == "1999")
        #expect(SearchViewModel.onlyDigits("") == "")
        #expect(SearchViewModel.onlyDigits("Jahr") == "")
        // Getippt wird Zeichen für Zeichen — ein Zwischenstand bleibt
        // stehen, er wird nur nicht zur Angabe.
        #expect(SearchViewModel.onlyDigits("19") == "19")
    }

    /// Erst vier Ziffern grenzen ein.
    ///
    /// Bei dreien duerfte nicht nach dem Jahr 199 gesucht werden — die
    /// Trefferliste waere beim Tippen von "1999" kurz leer, und das
    /// sieht aus, als gaebe es den Film nicht.
    @Test("Ein angefangenes Jahr grenzt noch nicht ein")
    @MainActor
    func partialYearDoesNotFilter() {
        let model = SearchViewModel(
            repository: SilentFilmRepository(), lazyFilms: SilentLazyRepository())

        model.yearText = "199"
        #expect(model.year == nil)
        #expect(model.yearIsIncomplete)

        model.yearText = "1999"
        #expect(model.year == 1999)
        #expect(!model.yearIsIncomplete)

        model.yearText = ""
        #expect(model.year == nil)
        #expect(!model.yearIsIncomplete, "ein leeres Feld ist nicht angefangen")
    }
}

/// Antwortet nichts. Fuer Tests, die den Zustand pruefen und nicht das
/// Netz.
private struct SilentLazyRepository: LazyFilmRepository {
    func create(term: String, year: Int?) async -> Result<[CreatedFilm], LazyFilmProblem> {
        .failure(.notFound)
    }
}

private struct SilentFilmRepository: FilmRepository {
    func search(term: String, limit: Int, year: Int?) async throws(BackendError) -> [Film] { [] }
    func wellKnownWithArtwork(limit: Int) async -> [Film] { [] }
    func shuffledWithArtwork(count: Int) async -> [Film] { [] }
}

/// Die Karte, die vor den Augen entsteht.
@Suite("Karte anlegen")
struct CardBuildTests {
    /// Fünfzehn Sekunden, in sechs Takten — wie im Web.
    ///
    /// Die Längen stehen an zwei Stellen: hier und in
    /// `apps/web/src/components/card-build.tsx`. Dieser Test ist das,
    /// was verhindert, dass sie auseinanderlaufen.
    @Test("Die sechs Takte dauern zusammen fünfzehn Sekunden")
    func beatsAddUp() {
        #expect(BuildBeat.dim.seconds == 2)
        #expect(BuildBeat.assemble.seconds == 3)
        #expect(BuildBeat.title.seconds == 3)
        #expect(BuildBeat.unroll.seconds == 2)
        #expect(BuildBeat.flip.seconds == 3)
        #expect(BuildBeat.restore.seconds == 2)
        #expect(BuildBeat.total == 15)
    }

    /// Jeder Takt beginnt, wo der vorige aufhört.
    @Test("Die Takte schließen lückenlos aneinander an")
    func beatsFollowOn() {
        var expected = 0.0
        for beat in BuildBeat.allCases {
            #expect(beat.start == expected, "\(beat) beginnt bei \(beat.start), nicht \(expected)")
            expected += beat.seconds
        }
        #expect(BuildBeat.done.start == 15)
    }

    /// Der Streuwert stimmt mit dem des Webs überein.
    ///
    /// Die Werte sind mit der Web-Umsetzung gerechnet, nicht mit der
    /// Swift-Fassung. Sonst prüfte der Test sich selbst.
    @Test("Der Streuwert ist derselbe wie im Web")
    func hashMatchesTheWeb() {
        #expect(FragmentField.hash32("Q47703") == 2_476_066_363)
        #expect(FragmentField.hash32("Q130232") == 1_561_731_379)
        // Mit Zeichen jenseits von ASCII — daran haette eine Zaehlung
        // ueber UTF-8 sich verraten.
        #expect(FragmentField.hash32("Grüße") == 2_012_106_360)
    }

    /// Die Grundfarbe wird aus dem SVG des Servers gelesen.
    @Test("Die Farben der Karte kommen aus der Antwort des Servers")
    func coloursComeFromTheServer() {
        let svg = #"""
            <svg viewBox="0 0 400 600"><defs><clipPath id="frame"><rect width="400"/></clipPath></defs>            <rect width="400" height="600" fill="#101526"/>            <circle fill="none" stroke="#1a2340" stroke-width="7"/></svg>
            """#

        #expect(PosterArtwork.firstColour(in: svg, attribute: "fill") == Color(hex: 0x101526))
        #expect(PosterArtwork.firstColour(in: svg, attribute: "stroke") == Color(hex: 0x1a2340))
        // `fill="none"` ist keine Farbe und darf nicht als eine gelesen
        // werden.
        #expect(PosterArtwork.firstColour(in: "<rect fill=\"none\"/>", attribute: "fill") == nil)
        #expect(PosterArtwork.firstColour(in: "", attribute: "fill") == nil)
    }

    /// Die Gründe, warum nichts angelegt wurde, sind unterscheidbar.
    ///
    /// „Das Jahr passt nicht" ist der einzige Fall, den der Suchende
    /// selbst beheben kann — er darf nicht in „such anders" untergehen.
    @Test("Ein falsches Jahr wird als solches gemeldet")
    func wrongYearIsItsOwnAnswer() {
        #expect(LazyFilmProblem.from(reason: "wrong_year") == .wrongYear)
        #expect(LazyFilmProblem.from(reason: "rate_limited") == .rateLimited)
        #expect(LazyFilmProblem.from(reason: "not_found") == .notFound)
        #expect(LazyFilmProblem.from(reason: nil) == .notFound)
        #expect(LazyFilmProblem.wrongYear.message.contains("Jahr"))
    }
}

/// Entdecken.
@Suite("Entdecken")
struct DiscoverTests {
    /// Jedes zugeordnete Bild liegt auch im Bündel.
    ///
    /// Die Zuordnung ist eine Tabelle von Hand. Ein Tippfehler oder eine
    /// umbenannte Datei fällt sonst erst auf, wenn ein Nutzer eine leere
    /// Kachel sieht — `Image(_:)` schweigt dazu.
    @Test("Zu jeder Genre-ID mit Bild gibt es das Bild auch wirklich")
    func artworkExists() {
        #expect(!GenreArtwork.known.isEmpty)

        for genreID in GenreArtwork.known {
            let name = GenreArtwork.name(for: genreID)
            #expect(name != nil, "\(genreID) hat keinen Namen")
            guard let name else { continue }
            #expect(
                UIImage(named: name, in: .main, compatibleWith: nil) != nil,
                "\(genreID): das Bild \(name) liegt nicht im Bündel")
        }
    }

    /// Kein Bild wird zweimal vergeben.
    @Test("Jedes Genre-Bild gehört zu genau einem Genre")
    func artworkIsNotShared() {
        let names = GenreArtwork.known.compactMap { GenreArtwork.name(for: $0) }
        #expect(names.count == Set(names).count, "ein Bild ist doppelt vergeben")
    }

    /// Jedes Genre mit Bild hat auch einen kurzen Namen.
    ///
    /// Ohne den stünde auf einer Kachel "Horror" und auf der daneben
    /// "Kriminalfilm" — halb gekürzt sieht aus wie vergessen.
    @Test("Jede Kachel mit Bild hat einen kurzen Namen")
    func everyTileHasAShortLabel() {
        for genreID in GenreArtwork.known {
            #expect(
                GenreLabel.short(for: genreID) != nil,
                "\(genreID) hat ein Bild, aber keinen kurzen Namen")
        }
    }

    /// Kein kurzer Name kommt zweimal vor.
    ///
    /// Die Falle ist naheliegend: Filmdrama und Psychodrama beide zu
    /// "Drama" zu kürzen. Zwei Kacheln mit demselben Namen sind für den
    /// Leser zwei Fehler.
    @Test("Kurze Namen sind eindeutig")
    func shortLabelsAreUnique() {
        let names = Array(GenreLabel.all.values)
        #expect(names.count == Set(names).count, "ein kurzer Name ist doppelt vergeben")
        #expect(names.allSatisfy { !$0.isEmpty })
        // Und keiner endet wieder auf "film" — dann waere die Kuerzung
        // vergessen worden.
        #expect(
            names.allSatisfy { !$0.lowercased().hasSuffix("film") },
            "ein kurzer Name endet noch auf \"film\"")
    }

    /// `numeric` kommt von PostgREST als Zeichenkette.
    ///
    /// Ein Decoder, der eine Zahl erwartet, nimmt beim ersten
    /// Durchschnitt die ganze Rangliste mit. Beide Formen müssen durch.
    @Test("Der Durchschnitt wird als Text und als Zahl gelesen")
    func averageDecodes() throws {
        let alsText = Data(
            #"{"place":1,"wikidata_id":"Q1","title_de":null,"title_original":"A","release_year":2000,"poster_source":null,"poster_url":null,"ratings":2,"average":"8.5"}"#
                .utf8)
        let alsZahl = Data(
            #"{"place":2,"wikidata_id":"Q2","title_de":null,"title_original":"B","release_year":2000,"poster_source":null,"poster_url":null,"ratings":1,"average":10}"#
                .utf8)
        let ohne = Data(
            #"{"place":3,"wikidata_id":"Q3","title_de":null,"title_original":"C","release_year":2000,"poster_source":null,"poster_url":null,"ratings":1,"average":null}"#
                .utf8)

        let a = try JSONDecoder().decode(WeeklyTopFilm.self, from: alsText)
        #expect(a.average == 8.5)
        // Halbiert wird genau einmal: 8,5 von zehn sind 4,25 Sterne.
        #expect(a.stars == 4.25)

        let b = try JSONDecoder().decode(WeeklyTopFilm.self, from: alsZahl)
        #expect(b.average == 10)
        #expect(b.stars == 5)

        let c = try JSONDecoder().decode(WeeklyTopFilm.self, from: ohne)
        #expect(c.average == nil)
        #expect(c.stars == nil)
    }

    /// Die Laufzeit wird als Stunden und Minuten gelesen.
    @Test("Die Laufzeit steht als Stunden und Minuten da")
    func runtimeReads() {
        func detail(_ minutes: Int?) -> FilmDetail {
            FilmDetail(
                film: Film(
                    wikidataID: "Q1", titleDE: nil, titleOriginal: "A", releaseYear: nil,
                    posterSource: nil, posterURL: nil),
                titleEN: nil, runtimeMinutes: minutes, synopsis: nil,
                directors: [], cast: [], genres: [])
        }

        #expect(detail(137).runtimeText == "2 h 17 min")
        #expect(detail(120).runtimeText == "2 h")
        #expect(detail(45).runtimeText == "45 min")
        #expect(detail(nil).runtimeText == nil)
        // Null Minuten ist keine Laufzeit, sondern eine fehlende.
        #expect(detail(0).runtimeText == nil)
    }

    /// Der zweite Titel steht nur da, wenn er etwas hinzufügt.
    @Test("Ein Zweittitel, der dem ersten gleicht, wird nicht wiederholt")
    func alternativeTitleAddsSomething() {
        func detail(de: String?, original: String, en: String?) -> FilmDetail {
            FilmDetail(
                film: Film(
                    wikidataID: "Q1", titleDE: de, titleOriginal: original, releaseYear: nil,
                    posterSource: nil, posterURL: nil),
                titleEN: en, runtimeMinutes: nil, synopsis: nil,
                directors: [], cast: [], genres: [])
        }

        #expect(detail(de: "Der Pate", original: "The Godfather", en: nil)
            .alternativeTitle == "The Godfather")
        // Ohne deutschen Titel zeigt die Seite den Originaltitel oben —
        // darunter noch einmal derselbe waere nur Laerm.
        #expect(detail(de: nil, original: "Solaris", en: "Solaris").alternativeTitle == nil)
        #expect(detail(de: "Solaris", original: "Solaris", en: "Solaris").alternativeTitle == nil)
    }

    /// Postgres liefert Zeitstempel mit und ohne Sekundenbruchteile.
    ///
    /// Beide müssen durchgehen. Ein Decoder, der nur eine Form kennt,
    /// nähme beim ersten Zeitstempel ohne Bruchteile den ganzen Feed
    /// mit.
    @Test("Zeitstempel werden mit und ohne Bruchteile gelesen")
    func timestampsParse() {
        #expect(FeedEntry.timestamp(from: "2026-08-31T10:15:30.123456+00:00") != nil)
        #expect(FeedEntry.timestamp(from: "2026-08-31T10:15:30+00:00") != nil)
        #expect(FeedEntry.timestamp(from: "2026-08-31T10:15:30Z") != nil)
        #expect(FeedEntry.timestamp(from: "kein Datum") == nil)
    }
}

/// Läuft gegen das echte Backend.
///
/// Kein Ersatz für die Tests oben, sondern die Antwort auf eine andere
/// Frage: steht die Kette von der App bis Postgres? Sie braucht Netz und
/// gehört deshalb nicht in jeden Durchlauf — aber einmal muss sie
/// gelaufen sein, sonst ist „es baut" alles, was man weiß.
///
///     LIVE_BACKEND=1 xcodebuild … -only-testing:BingeLogTests test
@Suite(
    "Gegen das echte Backend",
    .disabled(if: ProcessInfo.processInfo.environment["LIVE_BACKEND"] == nil)
)
struct LiveBackendTests {
    @Test("Reservierte und vergebene Namen werden erkannt")
    func checksNames() async throws {
        let profiles = LiveProfileRepository(backend: .live)

        // `bingelog` steht in `reserved_usernames` mit dem Grund
        // „brand", `kvn_undso` ist ein echtes Profil.
        #expect(await profiles.availability(of: "BingeLog") == .reserved)
        #expect(await profiles.availability(of: "kvn_undso") == .taken)
        #expect(await profiles.availability(of: "ab") == .tooShort)
    }

    @Test("Die Suche findet Solaris, mit Tippfehler")
    func searchesThroughToPostgres() async throws {
        let repository = LiveFilmRepository(backend: .live)

        // Dieselbe Eingabe wie im Web-Testfall: die Toleranz steckt in
        // `search_films`, nicht im Client.
        let films = try await repository.search(term: "solars", limit: 5)

        #expect(!films.isEmpty)
        #expect(films.contains { $0.title.contains("Solaris") })
    }
}
