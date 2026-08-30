import Foundation
import Testing

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
