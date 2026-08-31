import Foundation

/// Eine Genre-Kachel, so wie `genre_tiles` sie liefert.
struct GenreTile: Decodable, Identifiable, Hashable, Sendable {
    let genreID: String
    let label: String
    let films: Int

    var id: String { genreID }

    /// Das Bild dazu, falls es eins gibt.
    var artworkName: String? { GenreArtwork.name(for: genreID) }

    /// Wie es auf der Kachel steht.
    var shortLabel: String { GenreLabel.short(for: genreID) ?? label }

    enum CodingKeys: String, CodingKey {
        case genreID = "genre_id"
        case label
        case films
    }
}

/// Welches Bild zu welchem Genre gehört.
///
/// **Über die Wikidata-ID und nicht über die Beschriftung.** Die
/// Beschriftung ist `label_de` aus dem Katalog und kann sich ändern,
/// ohne dass es hier jemand merkt — die ID nicht. Dasselbe Prinzip wie
/// beim Abgleich mit TheTVDB (ADR-003): abgeglichen wird über
/// Bezeichner, nie über Titel.
///
/// Wie noetig das ist, hat sich beim Einpflegen gezeigt: eine der
/// sechzehn Dateien war als `Dramady` benannt, das Genre heisst
/// `Dramedy`. Ueber die Beschriftung haette diese Kachel kein Bild
/// gehabt — ueber die ID lief sie. Der Name ist inzwischen berichtigt,
/// der Grund gilt weiter.
///
/// Genres ohne Bild bekommen eine Kachel ohne Bild. Der Katalog kennt
/// vierzig Genres und wächst; sechzehn Bilder sind der Anfang, kein
/// Vollstaendigkeitsanspruch.
enum GenreArtwork {
    private static let byGenre: [String: String] = [
        "Q859369": "Genres/Dramedy",
        "Q130232": "Genres/Filmdrama",
        "Q157443": "Genres/Filmkomödie",
        "Q157394": "Genres/Fantasyfilm",
        "Q2484376": "Genres/Thriller",
        "Q319221": "Genres/Abenteuerfilm",
        "Q188473": "Genres/Actionfilm",
        "Q959790": "Genres/Kriminalfilm",
        "Q471839": "Genres/Science-Fiction-Film",
        "Q842256": "Genres/Musikfilm",
        "Q102429885": "Genres/Coming-of-Age-Film",
        "Q200092": "Genres/Horrorfilm",
        "Q1200678": "Genres/Mysteryfilm",
        "Q1054574": "Genres/Liebesfilm",
        "Q652256": "Genres/Monumentalfilm",
        "Q93204": "Genres/Dokumentarfilm",
    ]

    static func name(for genreID: String) -> String? { byGenre[genreID] }

    /// Für den Test: alle vergebenen IDs.
    static var known: [String] { Array(byGenre.keys) }
}

/// Kurze Namen für die Kacheln.
///
/// Der Katalog führt die Wikidata-Beschriftung, und die schreibt das
/// „film" aus: Horrorfilm, Kriminalfilm, Filmkomödie. Auf einer Kachel
/// ist das Wort überflüssig — es steht auf allen sechzehn und
/// unterscheidet keine von der anderen.
///
/// Eine Regel „hinten `film` abschneiden" reicht dafür nicht: aus
/// Kriminalfilm würde „Kriminal". Also von Hand, und wieder über die
/// Wikidata-ID.
///
/// **Nur die Anzeige.** Gespeichert und gesucht wird weiter mit der
/// Beschriftung aus dem Katalog. Ein Genre ohne Eintrag hier behält
/// seine, das ist der Normalfall für die vierundzwanzig, die keine
/// Kachel haben.
enum GenreLabel {
    private static let byGenre: [String: String] = [
        "Q130232": "Drama",  // Filmdrama
        "Q157443": "Komödie",  // Filmkomödie
        "Q157394": "Fantasy",  // Fantasyfilm
        "Q2484376": "Thriller",  // war schon kurz
        "Q319221": "Abenteuer",  // Abenteuerfilm
        "Q188473": "Action",  // Actionfilm
        "Q959790": "Krimi",  // Kriminalfilm — nicht "Kriminal"
        "Q471839": "Science-Fiction",  // Science-Fiction-Film
        "Q842256": "Musik",  // Musikfilm
        "Q102429885": "Coming of Age",  // Coming-of-Age-Film
        "Q200092": "Horror",  // Horrorfilm
        "Q1200678": "Mystery",  // Mysteryfilm
        "Q859369": "Dramedy",  // war schon kurz
        "Q93204": "Doku",  // Dokumentarfilm

        // Die beiden hier sind keine Kürzung, sondern ein anderes Wort.
        // "Liebe" und "Monumental" stehen allein nicht als Genre da, und
        // ein Kachelname, den man zweimal liest, ist kein guter.
        "Q1054574": "Romantik",  // Liebesfilm
        "Q652256": "Epos",  // Monumentalfilm
    ]

    static func short(for genreID: String) -> String? { byGenre[genreID] }

    /// Für den Test.
    static var all: [String: String] { byGenre }
}
