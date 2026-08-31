import Foundation
import Supabase

/// Ein Film auf der Watchlist, mit allem, was die Seite braucht.
nonisolated struct WatchlistEntry: Decodable, Identifiable, Sendable {
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let runtimeMinutes: Int?
    let posterSource: String?
    let posterURL: String?
    let addedAt: String
    /// Der Durchschnitt der Allgemeinheit, Skala 1 bis 10.
    let average: Double?
    let votes: Int
    let genreIDs: [String]
    let genreLabels: [String]
    /// Wie viele Freunde ihn empfohlen haben.
    let recommenders: Int
    let firstFriend: String?

    var id: String { filmID }
    var title: String { titleDE ?? titleOriginal }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    var added: Date? { FeedEntry.timestamp(from: addedAt) }

    /// Seit wie vielen Tagen er daliegt.
    var daysWaiting: Int? {
        guard let added else { return nil }
        return Calendar.current.dateComponents([.day], from: added, to: Date()).day
    }

    /// „Empfohlen von Pascal" oder „Von 3 Freunden empfohlen".
    var recommendationNote: String? {
        guard recommenders > 0 else { return nil }
        if recommenders == 1, let firstFriend { return "Empfohlen von \(firstFriend)" }
        return "Von \(recommenders) Freunden empfohlen"
    }

    /// Genres als Paare, für den Filter.
    var genres: [FilmGenre] {
        zip(genreIDs, genreLabels).map { FilmGenre(id: $0, label: $1) }
    }

    enum CodingKeys: String, CodingKey {
        case votes, average, recommenders
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case runtimeMinutes = "runtime_min"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case addedAt = "added_at"
        case genreIDs = "genre_ids"
        case genreLabels = "genre_labels"
        case firstFriend = "first_friend"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        filmID = try c.decode(String.self, forKey: .filmID)
        titleDE = try c.decodeIfPresent(String.self, forKey: .titleDE)
        titleOriginal = try c.decode(String.self, forKey: .titleOriginal)
        releaseYear = try c.decodeIfPresent(Int.self, forKey: .releaseYear)
        runtimeMinutes = try c.decodeIfPresent(Int.self, forKey: .runtimeMinutes)
        posterSource = try c.decodeIfPresent(String.self, forKey: .posterSource)
        posterURL = try c.decodeIfPresent(String.self, forKey: .posterURL)
        addedAt = try c.decode(String.self, forKey: .addedAt)
        votes = (try? c.decode(Int.self, forKey: .votes)) ?? 0
        // `numeric` kommt als Zeichenkette an.
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try? c.decodeIfPresent(Double.self, forKey: .average)
        }
        genreIDs = (try? c.decode([String].self, forKey: .genreIDs)) ?? []
        genreLabels = (try? c.decode([String].self, forKey: .genreLabels)) ?? []
        recommenders = (try? c.decode(Int.self, forKey: .recommenders)) ?? 0
        firstFriend = try c.decodeIfPresent(String.self, forKey: .firstFriend)
    }
}

/// Wonach die Watchlist sortiert wird.
nonisolated enum WatchlistOrder: String, CaseIterable, Identifiable, Sendable {
    case newestAdded
    case oldestAdded
    case bestRated
    case worstRated
    case newestFilm
    case oldestFilm
    case shortest
    case longest
    case alphabetical

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newestAdded: return "Zuletzt hinzugefügt"
        case .oldestAdded: return "Zuerst hinzugefügt"
        case .bestRated: return "Beste Bewertung"
        case .worstRated: return "Niedrigste Bewertung"
        case .newestFilm: return "Jahr, neu nach alt"
        case .oldestFilm: return "Jahr, alt nach neu"
        case .shortest: return "Kürzeste Laufzeit"
        case .longest: return "Längste Laufzeit"
        case .alphabetical: return "Alphabetisch"
        }
    }

    /// Wie zwei Einträge verglichen werden.
    ///
    /// Als eigene Funktion, weil sich eine Liste schlecht prüfen lässt,
    /// die Ordnung dahinter aber gut.
    ///
    /// **Fehlende Angaben stehen immer hinten**, in jeder Richtung. Ein
    /// Film ohne Laufzeit ist nicht der kürzeste, und einer ohne
    /// Bewertung ist nicht der schlechteste.
    func sorts(_ a: WatchlistEntry, _ b: WatchlistEntry) -> Bool {
        switch self {
        case .newestAdded: return a.addedAt > b.addedAt
        case .oldestAdded: return a.addedAt < b.addedAt
        case .bestRated: return WatchlistOrder.compare(a.average, b.average, ascending: false)
        case .worstRated: return WatchlistOrder.compare(a.average, b.average, ascending: true)
        case .newestFilm:
            return WatchlistOrder.compare(
                a.releaseYear.map(Double.init), b.releaseYear.map(Double.init), ascending: false)
        case .oldestFilm:
            return WatchlistOrder.compare(
                a.releaseYear.map(Double.init), b.releaseYear.map(Double.init), ascending: true)
        case .shortest:
            return WatchlistOrder.compare(
                a.runtimeMinutes.map(Double.init), b.runtimeMinutes.map(Double.init),
                ascending: true)
        case .longest:
            return WatchlistOrder.compare(
                a.runtimeMinutes.map(Double.init), b.runtimeMinutes.map(Double.init),
                ascending: false)
        case .alphabetical:
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        }
    }

    static func compare(_ a: Double?, _ b: Double?, ascending: Bool) -> Bool {
        switch (a, b) {
        case (nil, nil): return false
        case (nil, _): return false
        case (_, nil): return true
        case (let x?, let y?): return ascending ? x < y : x > y
        }
    }
}

extension LiveFilmEntryRepository {
    /// Die eigene Watchlist, in einer Anfrage.
    func watchlist() async -> [WatchlistEntry] {
        let rows: [WatchlistEntry]? = try? await backend.client
            .rpc("watchlist_for_me")
            .execute()
            .value
        return rows ?? []
    }
}
