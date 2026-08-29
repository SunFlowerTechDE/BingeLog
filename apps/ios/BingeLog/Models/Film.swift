import Foundation

/// Ein Film, so wie der Katalog ihn liefert.
///
/// Die Feldnamen folgen der Datenbank, nicht der Swift-Gewohnheit —
/// `CodingKeys` übersetzt einmal an dieser Stelle, statt bei jedem
/// Aufruf.
struct Film: Codable, Identifiable, Hashable, Sendable {
    let wikidataID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?

    var id: String { wikidataID }

    /// Der Titel, den ein deutscher Leser erwartet.
    var title: String { titleDE ?? titleOriginal }

    /// Wo das Plakat liegt.
    ///
    /// Bei einem echten Plakat die Adresse von TheTVDB — **verlinkt,
    /// nie gespiegelt** (docs/legal/thetvdb-lizenz.md). Sonst die
    /// prozedurale Karte vom eigenen Server: die wird nicht dreimal
    /// nachgebaut, sonst sähe derselbe Film auf Web, iPhone und Android
    /// verschieden aus (ADR-012, M5 5.5).
    func posterAddress(webBase: URL) -> URL? {
        if posterSource == "tvdb", let posterURL { return URL(string: posterURL) }
        return webBase.appendingPathComponent("poster/\(wikidataID)")
    }

    enum CodingKeys: String, CodingKey {
        case wikidataID = "wikidata_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
    }
}
