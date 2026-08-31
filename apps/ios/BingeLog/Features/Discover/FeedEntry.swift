import Foundation

/// Ein Eintrag im Feed, so wie `following_feed` ihn liefert.
///
/// Flach und nicht verschachtelt, weil die Funktion flach zurückgibt.
/// Den Film setzt ``film`` daraus wieder zusammen, damit die Plakat-
/// Adresse an genau einer Stelle im Projekt entsteht.
struct FeedEntry: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let createdAt: String
    let rating: Int?
    let review: String?
    let watchedOn: String?
    let isRewatch: Bool
    let username: String
    let avatarPath: String?
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?

    /// Zeitangaben als Text und nicht als `Date`.
    ///
    /// `created_at` ist ein `timestamptz`, `watched_on` ein `date` —
    /// zwei Formate, die ein Decoder mit einer Einstellung nicht beide
    /// trifft. Ein fehlschlagender Decoder nimmt den ganzen Feed mit,
    /// nicht nur das Datum. Also wird gelesen, was kommt, und hier
    /// ausgewertet.
    var watchedDate: Date? {
        guard let watchedOn else { return nil }
        return FeedEntry.dayFormatter.date(from: watchedOn)
    }

    var createdDate: Date? { FeedEntry.timestamp(from: createdAt) }

    var film: Film {
        Film(
            wikidataID: filmID,
            titleDE: titleDE,
            titleOriginal: titleOriginal,
            releaseYear: releaseYear,
            posterSource: posterSource,
            posterURL: posterURL
        )
    }

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    /// Mit und ohne Sekundenbruchteile — Postgres liefert beides, je
    /// nachdem, ob der Zeitstempel welche hat.
    static func timestamp(from text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: text) { return date }

        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: text)
    }

    enum CodingKeys: String, CodingKey {
        case id
        case createdAt = "created_at"
        case rating
        case review
        case watchedOn = "watched_on"
        case isRewatch = "is_rewatch"
        case username
        case avatarPath = "avatar_path"
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
    }
}
