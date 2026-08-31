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
            repository: SilentFilmRepository(), lazyFilms: SilentLazyRepository(),
            entries: SilentEntryRepository())

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
    func look(term: String, year: Int?) async -> Result<[FilmCandidate], LazyFilmProblem> {
        .failure(.notFound)
    }
    func adopt(_ candidate: FilmCandidate) async -> Result<CreatedFilm, LazyFilmProblem> {
        .failure(.notFound)
    }
}

/// Antwortet auf alles mit nichts.
private struct SilentEntryRepository: FilmEntryRepository {
    func summary(for filmID: String) async -> RatingSummary { RatingSummary(average: nil, votes: 0) }
    func ownEntry(for filmID: String) async -> OwnEntry? { nil }
    func isOnWatchlist(_ filmID: String) async -> Bool { false }
    func setWatchlist(_ filmID: String, on: Bool) async -> Bool { on }
    func save(
        filmID: String, rating: Int, watchedOn: Date?, review: String?,
        visibility: EntryVisibility
    ) async -> EntrySaved { .failed("stumm") }
    func ownFacets(for filmID: String) async -> [FacetKind: Int] { [:] }
    func facetAverages(for filmID: String) async -> [FacetAverage] { [] }
    func replaceFacets(entryID: UUID, with scores: [FacetKind: Int]) async {}
    func reviews(for filmID: String, limit: Int) async -> [FilmReview] { [] }
    func thread(for filmID: String) async -> ThreadState { .none }
    func discussionThreshold() async -> Int { 5 }
    func messages(for filmID: String) async -> [ThreadMessage] { [] }
    func post(filmID: String, body: String, replyingTo parent: UUID?) async -> SaveOutcome {
        .failed("stumm")
    }
    func friendsForRecommendation(film: String) async -> [RecommendationTarget] { [] }
    func recommend(film: String, to friends: [UUID], note: String?) async -> SaveOutcome {
        .failed("stumm")
    }
    func recommendationsForMe(limit: Int) async -> [Recommendation] { [] }
    func dismissRecommendation(film: String) async {}
    func watchlist() async -> [WatchlistEntry] { [] }
    func statuses(for filmIDs: [String]) async -> FilmStatuses { .none }
    func diary() async -> [DiaryEntry] { [] }
    func diarySummary() async -> DiarySummary { .none }
    func updateEntry(
        id: UUID, rating: Int, watchedOn: Date?, review: String?, visibility: EntryVisibility
    ) async -> SaveOutcome { .failed("stumm") }
    func deleteEntry(id: UUID) async -> SaveOutcome { .failed("stumm") }
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

/// Die Bewertungsskala.
@Suite("Popcorn")
struct PopcornTests {
    /// Zehn Halbe werden zu fünf Eimern.
    ///
    /// Die Zuordnung ist dieselbe wie im Web (`fillFor` in
    /// `popcorn.tsx`), und sie steht jetzt an zwei Stellen — deshalb
    /// dieser Test.
    @Test("Jede Bewertung füllt die richtigen Eimer")
    func bucketsFill() {
        func row(_ rating: Int) -> [Int] {
            (0..<5).map { Popcorn.fill(rating: Double(rating), index: $0) }
        }

        #expect(row(10) == [2, 2, 2, 2, 2], "fünf volle")
        #expect(row(1) == [1, 0, 0, 0, 0], "ein halber")
        #expect(row(7) == [2, 2, 2, 1, 0], "drei volle und ein halber")
        #expect(row(0) == [0, 0, 0, 0, 0], "keine Bewertung ist keine Füllung")
    }

    /// Halbiert wird genau einmal, und mit deutschem Komma.
    @Test("Die Zahl daneben steht auf der Skala bis fünf")
    func formatsOnTheFiveScale() {
        #expect(Popcorn.format(10) == "5,0")
        #expect(Popcorn.format(7) == "3,5")
        #expect(Popcorn.format(1) == "0,5")
        // Der Durchschnitt kommt als Kommazahl auf derselben Skala.
        #expect(Popcorn.format(8.5) == "4,3")
    }

    /// Die Zahl neben der Skala steht mit deutschem Komma.
    ///
    /// In der Wochenrangliste stand "4.5" mit Punkt — daneben auf
    /// derselben Seite "4,5" mit Komma. Zwei Schreibweisen für dieselbe
    /// Zahl auf einem Bildschirm sind ein Fehler, kein Detail.
    @Test("Die Zahl wird nie mit Punkt geschrieben")
    func neverWritesADot() {
        for raw in stride(from: 1, through: 10, by: 1) {
            let text = Popcorn.format(raw)
            #expect(!text.contains("."), "\(raw) wurde als \(text) geschrieben")
            #expect(text.contains(","))
        }
        #expect(!Popcorn.format(8.5).contains("."))
    }

    /// Die drei Sichtbarkeiten heissen so wie in der Datenbank.
    ///
    /// Ein Tippfehler hier ergäbe keinen Fehler beim Übersetzen, sondern
    /// einen abgewiesenen Schreibvorgang zur Laufzeit — oder, schlimmer,
    /// einen Eintrag mit der falschen Sichtbarkeit.
    @Test("Die Sichtbarkeiten heissen wie die Werte im Schema")
    func visibilityMatchesTheSchema() {
        #expect(EntryVisibility.publicly.rawValue == "public")
        #expect(EntryVisibility.friends.rawValue == "friends")
        #expect(EntryVisibility.privately.rawValue == "private")
        #expect(EntryVisibility.allCases.count == 3)
        // Und öffentlich steht zuerst, wie im Entwurf.
        #expect(EntryVisibility.allCases.first == .publicly)
    }

    /// Die FSK-Stufen und ihre amtlichen Farben.
    @Test("Unbekannt ist nicht dasselbe wie FSK 0")
    func unknownIsNotZero() {
        #expect(FSKLevel.level(for: 0)?.label == "FSK 0")
        #expect(FSKLevel.level(for: 18)?.text == "ab 18 Jahren")
        #expect(FSKLevel.level(for: nil) == nil, "nil heisst nicht bekannt")
        #expect(FSKLevel.level(for: 14) == nil, "FSK 14 gibt es nicht")
        #expect(FSKLevel.all.count == 5)
    }
}

/// Der Suchverlauf und die Fehlerzustände.
@Suite("Suchverlauf")
struct SearchHistoryTests {
    /// Ein wiederholter Begriff rückt vor, statt zweimal dazustehen.
    @Test("Derselbe Begriff steht nur einmal im Verlauf")
    func repeatedTermMovesUp() {
        var verlauf = ["Michael", "Vaiana"]
        verlauf = SearchHistory.adding("The Odyssey", to: verlauf)
        #expect(verlauf == ["The Odyssey", "Michael", "Vaiana"])

        verlauf = SearchHistory.adding("michael", to: verlauf)
        #expect(verlauf == ["michael", "The Odyssey", "Vaiana"], "Gross und klein ist derselbe")
        #expect(verlauf.count == 3)
    }

    /// Zu kurze Begriffe kommen gar nicht erst hinein.
    @Test("Unter zwei Zeichen wird nichts gemerkt")
    func shortTermsAreNotRemembered() {
        #expect(SearchHistory.adding("a", to: ["Michael"]) == ["Michael"])
        #expect(SearchHistory.adding("  ", to: ["Michael"]) == ["Michael"])
        #expect(SearchHistory.adding(" Dune ", to: []) == ["Dune"], "getrimmt gemerkt")
    }

    /// Der Verlauf wächst nicht endlos.
    @Test("Der Verlauf hält höchstens acht Begriffe")
    func historyIsCapped() {
        var verlauf: [String] = []
        for index in 0..<20 { verlauf = SearchHistory.adding("Film \(index)", to: verlauf) }
        #expect(verlauf.count == 8)
        #expect(verlauf.first == "Film 19", "das Jüngste steht vorn")
    }

    /// Die Fehlerfälle sind auseinandergehalten — und nennen die Quelle
    /// nicht.
    ///
    /// Der Nutzer soll verstehen, dass ausserhalb des Katalogs gesucht
    /// wurde. Woher die Daten kommen, hilft ihm nicht (Suchkonzept, 6).
    @Test("Keine Fehlermeldung nennt die Datenquelle")
    func messagesNeverNameTheSource() {
        let alle: [LazyFilmProblem] = [
            .tooShort, .rateLimited, .wrongYear, .notFound, .offline,
            .sourceUnreachable, .saveFailed, .alreadyThere,
        ]
        for problem in alle {
            let text = problem.message.lowercased()
            #expect(!text.contains("wikidata"), "\(problem) nennt die Quelle")
            #expect(!text.contains("tvdb"))
            #expect(!problem.message.isEmpty)
        }
        // Und nur beim Jahr lohnt sich der zweite Versuch ohne Jahr.
        #expect(LazyFilmProblem.wrongYear.suggestsDroppingTheYear)
        #expect(!LazyFilmProblem.notFound.suggestsDroppingTheYear)
    }

    /// Kein Netz ist etwas anderes als eine Quelle, die schweigt.
    @Test("Fehlendes Netz wird als solches erkannt")
    func offlineIsItsOwnCase() {
        let ohneNetz = NSError(
            domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        #expect(LazyFilmProblem.from(error: ohneNetz) == .offline)

        let anderes = NSError(domain: NSURLErrorDomain, code: NSURLErrorBadServerResponse)
        #expect(LazyFilmProblem.from(error: anderes) == .sourceUnreachable)
    }
}

/// Das Tagebuch.
@Suite("Tagebuch")
struct DiaryTests {
    private func entry(
        id: String, title: String, rating: Int?, watchedOn: String?, createdAt: String,
        review: String? = nil, visibility: String = "public", rewatch: Bool = false,
        genres: [String] = []
    ) -> DiaryEntry {
        let ids = genres.map { "\"\($0)\"" }.joined(separator: ",")
        let json = """
            {"id":"\(id)","film_id":"Q1","title_de":"\(title)","title_original":"\(title)",
             "release_year":2000,"runtime_min":100,"poster_source":null,"poster_url":null,
             "rating":\(rating.map(String.init) ?? "null"),
             "review":\(review.map { "\"\($0)\"" } ?? "null"),
             "watched_on":\(watchedOn.map { "\"\($0)\"" } ?? "null"),
             "is_rewatch":\(rewatch),"visibility":"\(visibility)",
             "created_at":"\(createdAt)","genre_ids":[\(ids)],"genre_labels":[\(ids)]}
            """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(DiaryEntry.self, from: Data(json.utf8))
    }

    /// Ein Eintrag ohne Sehdatum ist kein Eintrag von 1970.
    ///
    /// Er wird unter seinem Eintragszeitpunkt einsortiert — und die
    /// Zeile sagt dazu, dass das Datum nicht das Sehdatum ist.
    @Test("Ohne Sehdatum zählt der Eintragszeitpunkt")
    func missingWatchedDateFallsBackToCreation() {
        let ohne = entry(
            id: "11111111-1111-1111-1111-111111111111", title: "Ohne", rating: 8,
            watchedOn: nil, createdAt: "2026-08-30T10:00:00+00:00")
        #expect(!ohne.hasWatchedDate)
        #expect(ohne.effectiveDate != nil)

        let mit = entry(
            id: "22222222-2222-2222-2222-222222222222", title: "Mit", rating: 8,
            watchedOn: "2026-08-20", createdAt: "2026-08-30T10:00:00+00:00")
        #expect(mit.hasWatchedDate)

        // Und einsortiert wird nach dem, was gilt: der ohne Datum ist
        // der jüngere, weil er heute eingetragen wurde.
        let sortiert = [mit, ohne].sorted(by: DiaryOrder.newest.sorts)
        #expect(sortiert.first?.title == "Ohne")
    }

    /// Monate werden zusammengefasst, nicht Einträge gezählt.
    @Test("Zwei Einträge aus demselben Monat stehen unter einer Überschrift")
    func sameMonthSharesAHeading() {
        let formatter = ISO8601DateFormatter()
        let august = formatter.date(from: "2026-08-20T10:00:00Z")
        let september = formatter.date(from: "2026-09-02T10:00:00Z")

        #expect(DiaryModel.monthKey(for: august) == DiaryModel.monthKey(for: formatter.date(
            from: "2026-08-29T10:00:00Z")))
        #expect(DiaryModel.monthKey(for: august) != DiaryModel.monthKey(for: september))
        #expect(DiaryModel.monthTitle(for: august) == "August 2026")
        #expect(DiaryModel.monthTitle(for: nil) == "Ohne Datum")
    }

    /// Die Suche greift auch in die eigene Rezension.
    ///
    /// „Was habe ich damals über den Schluss geschrieben" ist eine echte
    /// Frage an ein Tagebuch — und die Antwort steht nicht im Titel.
    @Test("Gesucht wird in Titel und Rezension")
    func searchReachesTheReview() {
        let a = entry(
            id: "11111111-1111-1111-1111-111111111111", title: "Dune", rating: 9,
            watchedOn: "2026-08-01", createdAt: "2026-08-01T10:00:00+00:00",
            review: "Der Schluss hat mich umgehauen")
        let b = entry(
            id: "22222222-2222-2222-2222-222222222222", title: "Der Schluss", rating: 5,
            watchedOn: "2026-08-02", createdAt: "2026-08-02T10:00:00+00:00")

        let treffer = DiaryModel.select(
            from: [a, b], term: "schluss", genre: nil, visibility: nil,
            onlyWithReview: false, onlyRewatches: false)
        #expect(treffer.count == 2, "Titel und Rezension zählen beide")

        #expect(
            DiaryModel.select(
                from: [a, b], term: "umgehauen", genre: nil, visibility: nil,
                onlyWithReview: false, onlyRewatches: false
            ).map(\.title) == ["Dune"])
    }

    /// Die Filter wirken gemeinsam.
    @Test("Sichtbarkeit und Rezension filtern zusammen")
    func filtersCombine() {
        let privat = entry(
            id: "11111111-1111-1111-1111-111111111111", title: "Privat", rating: 8,
            watchedOn: "2026-08-01", createdAt: "2026-08-01T10:00:00+00:00",
            review: "geheim", visibility: "private")
        let offen = entry(
            id: "22222222-2222-2222-2222-222222222222", title: "Offen", rating: 8,
            watchedOn: "2026-08-02", createdAt: "2026-08-02T10:00:00+00:00",
            visibility: "public")
        let alle = [privat, offen]

        #expect(
            DiaryModel.select(
                from: alle, term: "", genre: nil, visibility: .privately,
                onlyWithReview: false, onlyRewatches: false
            ).map(\.title) == ["Privat"])

        #expect(
            DiaryModel.select(
                from: alle, term: "", genre: nil, visibility: nil,
                onlyWithReview: true, onlyRewatches: false
            ).map(\.title) == ["Privat"], "eine leere Rezension zählt nicht als Rezension")
    }
}

/// Die Watchlist.
@Suite("Watchlist")
struct WatchlistTests {
    private func entry(
        id: String, title: String, year: Int?, runtime: Int?, average: Double?,
        genres: [String] = [], recommenders: Int = 0
    ) -> WatchlistEntry {
        let ids = genres.map { "\"\($0)\"" }.joined(separator: ",")
        let json = """
            {"film_id":"\(id)","title_de":"\(title)","title_original":"\(title)",
             "release_year":\(year.map(String.init) ?? "null"),
             "runtime_min":\(runtime.map(String.init) ?? "null"),
             "poster_source":null,"poster_url":null,
             "added_at":"2026-08-01T10:00:00+00:00",
             "average":\(average.map { "\"\($0)\"" } ?? "null"),"votes":1,
             "genre_ids":[\(ids)],"genre_labels":[\(ids)],
             "recommenders":\(recommenders),"first_friend":null}
            """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(WatchlistEntry.self, from: Data(json.utf8))
    }

    /// Fehlende Angaben stehen in **jeder** Richtung hinten.
    ///
    /// Ein Film ohne Laufzeit ist nicht der kürzeste, und einer ohne
    /// Bewertung nicht der schlechteste. Ohne diese Regel wandern alle
    /// unvollständigen Einträge beim Umschalten der Richtung nach vorn.
    @Test("Ein Film ohne Angabe steht nie vorn")
    func missingValuesSortLast() {
        let mit = entry(id: "Q1", title: "Mit", year: 2000, runtime: 90, average: 8)
        let ohne = entry(id: "Q2", title: "Ohne", year: nil, runtime: nil, average: nil)

        for order in [
            WatchlistOrder.bestRated, .worstRated, .newestFilm, .oldestFilm, .shortest, .longest,
        ] {
            let sortiert = [ohne, mit].sorted(by: order.sorts)
            #expect(sortiert.first?.filmID == "Q1", "\(order.label) stellt den leeren nach vorn")
        }
    }

    /// Der Laufzeitfilter wirft Filme ohne Laufzeit heraus.
    ///
    /// Dieselbe Regel wie beim Jahr in der Suche: unbekannt ist nicht
    /// kurz.
    @Test("Ohne Laufzeit passt ein Film zu keiner Höchstlaufzeit")
    func runtimeFilterExcludesUnknown() {
        let kurz = entry(id: "Q1", title: "Kurz", year: 2000, runtime: 80, average: nil)
        let lang = entry(id: "Q2", title: "Lang", year: 2000, runtime: 180, average: nil)
        let ohne = entry(id: "Q3", title: "Ohne", year: 2000, runtime: nil, average: nil)
        let alle = [kurz, lang, ohne]

        let gefiltert = WatchlistModel.select(
            from: alle, term: "", genre: nil, maximumRuntime: 90, onlyRecommended: false)
        #expect(gefiltert.map(\.filmID) == ["Q1"])

        // Ohne Filter ist er wieder dabei.
        #expect(
            WatchlistModel.select(
                from: alle, term: "", genre: nil, maximumRuntime: nil, onlyRecommended: false
            ).count == 3)
    }

    /// Suche, Genre und „von Freunden" greifen zusammen.
    @Test("Die Filter wirken gemeinsam, nicht nacheinander")
    func filtersCombine() {
        let a = entry(
            id: "Q1", title: "Horror eins", year: 2000, runtime: 90, average: nil,
            genres: ["Q200092"], recommenders: 2)
        let b = entry(
            id: "Q2", title: "Horror zwei", year: 2000, runtime: 90, average: nil,
            genres: ["Q200092"])
        let c = entry(
            id: "Q3", title: "Komödie", year: 2000, runtime: 90, average: nil,
            genres: ["Q157443"], recommenders: 1)
        let alle = [a, b, c]

        #expect(
            WatchlistModel.select(
                from: alle, term: "horror", genre: nil, maximumRuntime: nil,
                onlyRecommended: false
            ).map(\.filmID) == ["Q1", "Q2"], "die Suche ignoriert Gross- und Kleinschreibung")

        #expect(
            WatchlistModel.select(
                from: alle, term: "", genre: "Q200092", maximumRuntime: nil,
                onlyRecommended: true
            ).map(\.filmID) == ["Q1"], "Genre und Empfehlung zusammen lassen einen uebrig")
    }

    /// Die Kennzeichnung nennt einen beim Namen und zählt mehrere.
    @Test("Ohne Empfehlung steht kein Hinweis da")
    func recommendationNoteAppearsOnlyWhenThereIsOne() {
        #expect(
            entry(id: "Q1", title: "A", year: nil, runtime: nil, average: nil).recommendationNote
                == nil)
        #expect(
            entry(id: "Q2", title: "B", year: nil, runtime: nil, average: nil, recommenders: 3)
                .recommendationNote == "Von 3 Freunden empfohlen")
    }
}

/// Empfehlungen unter Freunden.
@Suite("Empfehlen")
struct RecommendationTests {
    private func entry(friends: Int, first: String, note: String? = nil) -> Recommendation {
        let json = """
            {"film_id":"Q1","title_de":null,"title_original":"A","release_year":2000,
             "poster_source":null,"poster_url":null,"friends":\(friends),
             "first_friend":"\(first)","note":\(note.map { "\"\($0)\"" } ?? "null"),
             "friend_rating":9}
            """
        // swiftlint:disable:next force_try
        return try! JSONDecoder().decode(Recommendation.self, from: Data(json.utf8))
    }

    /// Einer wird benannt, mehrere werden gezählt.
    @Test("Einer heisst beim Namen, mehrere werden gezählt")
    func headlineCountsOrNames() {
        #expect(entry(friends: 1, first: "Pascal").headline == "Pascal empfiehlt dir diesen Film")
        #expect(entry(friends: 3, first: "Pascal").headline == "3 Freunde empfehlen dir diesen Film")
        // Nicht "1 Freunde" und nicht "Pascal und 2 andere" — der eine
        // Fall ist ein Name, der andere eine Zahl.
        #expect(!entry(friends: 1, first: "Pascal").headline.contains("1 Freund"))
    }

    /// Die Bewertung des Freundes steht auf der internen Skala.
    @Test("Die Bewertung des Freundes wird einmal halbiert")
    func friendRatingIsOnTheInternalScale() throws {
        let one = entry(friends: 1, first: "Sarah")
        #expect(one.friendRating == 9)
        // Die Ansicht reicht sie als Double an PopcornRating weiter, das
        // selbst halbiert — 9 von 10 sind 4,5 Popcorn.
        #expect(Popcorn.format(9) == "4,5")
    }

    /// Eine fehlende Notiz ist kein leerer Text.
    @Test("Ohne Notiz steht kein leeres Anführungszeichen da")
    func missingNoteStaysNil() {
        #expect(entry(friends: 1, first: "Pascal").note == nil)
        #expect(entry(friends: 1, first: "Pascal", note: "Musst du sehen").note == "Musst du sehen")
    }
}

/// Die erweiterte Bewertung.
@Suite("Facetten")
struct FacetTests {
    /// Die sieben Facetten heissen wie die Werte des Enums im Schema.
    ///
    /// Ein Tippfehler ergäbe keinen Übersetzungsfehler, sondern eine
    /// abgewiesene Zeile zur Laufzeit — `production_design` ist der
    /// Kandidat dafür.
    @Test("Die Facetten heissen wie facet_kind in der Datenbank")
    func facetsMatchTheSchema() {
        #expect(FacetKind.allCases.count == 7)
        #expect(FacetKind.allCases.map(\.rawValue) == [
            "acting", "story", "directing", "cinematography",
            "sound", "production_design", "pacing",
        ])
        // Und jede hat eine deutsche Beschriftung.
        #expect(FacetKind.allCases.allSatisfy { !$0.label.isEmpty })
        #expect(FacetKind.productionDesign.label == "Setting und Ausstattung")
    }

    /// Facetten fliessen **nicht** in die Gesamtbewertung ein.
    ///
    /// Das ist eine Zusicherung aus ADR-009 und kein Detail. Der Test
    /// hält fest, dass es keinen Weg von den Facetten zur Bewertung
    /// gibt: das Formular hält beide getrennt, und gespeichert werden
    /// sie über zwei verschiedene Tabellen.
    @Test("Eine leere Facette ist keine Bewertung von null")
    func emptyFacetIsNotZero() {
        var scores: [FacetKind: Int] = [:]
        #expect(scores[.acting] == nil, "nicht gesetzt ist nicht dasselbe wie gesetzt")
        scores[.acting] = 8
        #expect(scores.values.filter { $0 > 0 }.count == 1)
        // Nur Werte von 1 bis 10 sind gueltig; alles andere faellt beim
        // Schreiben heraus.
        #expect(!(1...10).contains(0))
        #expect((1...10).contains(8))
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
                titleEN: nil, runtimeMinutes: minutes, fsk: nil, synopsis: nil,
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
                titleEN: en, runtimeMinutes: nil, fsk: nil, synopsis: nil,
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
