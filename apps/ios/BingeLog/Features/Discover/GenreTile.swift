import Foundation

/// Eine Genre-Kachel, so wie `genre_tiles` sie liefert.
struct GenreTile: Decodable, Identifiable, Hashable, Sendable {
    let genreID: String
    let label: String
    let films: Int

    var id: String { genreID }

    /// Das Bild dazu, falls es eins gibt.
    var artworkName: String? { GenreArtwork.name(for: genreID) }

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
/// Der Beweis, dass das die richtige Entscheidung war, steht gleich in
/// der ersten Zeile: die Datei heißt `Dramady`, das Genre heißt
/// `Dramedy`. Über die Beschriftung hätte diese Kachel kein Bild.
///
/// Genres ohne Bild bekommen eine Kachel ohne Bild. Der Katalog kennt
/// vierzig Genres und wächst; sechzehn Bilder sind der Anfang, kein
/// Vollstaendigkeitsanspruch.
enum GenreArtwork {
    private static let byGenre: [String: String] = [
        "Q859369": "Genres/Dramady",
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
