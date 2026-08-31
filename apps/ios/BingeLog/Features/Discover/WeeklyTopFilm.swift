import Foundation

/// Ein Platz in der Wochenrangliste, so wie `weekly_top_films` ihn
/// liefert.
struct WeeklyTopFilm: Decodable, Identifiable, Hashable, Sendable {
    let place: Int
    let wikidataID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?
    let ratings: Int
    /// Der Durchschnitt auf der **internen** Skala 1 bis 10.
    let average: Double?

    var id: String { wikidataID }

    var film: Film {
        Film(
            wikidataID: wikidataID,
            titleDE: titleDE,
            titleOriginal: titleOriginal,
            releaseYear: releaseYear,
            posterSource: posterSource,
            posterURL: posterURL
        )
    }

    /// Derselbe Wert in Sternen.
    ///
    /// Die Datenbank rechnet in halben Sternen als ganze Zahlen 1 bis 10
    /// (M3 3.4). Hier wird **einmal** halbiert und sonst nirgends — im
    /// Web war zweimaliges Halbieren schon einmal der Fehler.
    var stars: Double? {
        guard let average else { return nil }
        return average / 2
    }

    enum CodingKeys: String, CodingKey {
        case place
        case wikidataID = "wikidata_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case ratings
        case average
    }

    /// `numeric` kommt als Zeichenkette an, nicht als Zahl.
    ///
    /// PostgREST gibt `numeric` als String aus, weil ein Double nicht
    /// jeden Wert exakt trägt. Ohne diesen Umweg schlüge das Decoden
    /// fehl und nähme die ganze Liste mit.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        place = try c.decode(Int.self, forKey: .place)
        wikidataID = try c.decode(String.self, forKey: .wikidataID)
        titleDE = try c.decodeIfPresent(String.self, forKey: .titleDE)
        titleOriginal = try c.decode(String.self, forKey: .titleOriginal)
        releaseYear = try c.decodeIfPresent(Int.self, forKey: .releaseYear)
        posterSource = try c.decodeIfPresent(String.self, forKey: .posterSource)
        posterURL = try c.decodeIfPresent(String.self, forKey: .posterURL)
        ratings = try c.decode(Int.self, forKey: .ratings)

        // Erst als Text, dann als Zahl. `try?` auf ein `decodeIfPresent`
        // ergibt zweimal optional — deshalb hier ausgeschrieben und
        // nicht mit `flatMap`, das sonst auf der Zeichenkette landet.
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try c.decodeIfPresent(Double.self, forKey: .average)
        }
    }
}
