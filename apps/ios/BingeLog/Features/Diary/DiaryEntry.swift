import Foundation
import Supabase

/// Ein Eintrag im eigenen Tagebuch.
struct DiaryEntry: Decodable, Identifiable, Sendable {
    let id: UUID
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let runtimeMinutes: Int?
    let posterSource: String?
    let posterURL: String?
    let rating: Int?
    let review: String?
    let watchedOn: String?
    let isRewatch: Bool
    let visibility: EntryVisibility
    let createdAt: String
    let genreIDs: [String]
    let genreLabels: [String]

    var title: String { titleDE ?? titleOriginal }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    var genres: [FilmGenre] { zip(genreIDs, genreLabels).map { FilmGenre(id: $0, label: $1) } }

    /// Der Tag, unter dem der Eintrag einsortiert wird.
    ///
    /// Ohne Sehdatum der Eintragszeitpunkt. Ein Eintrag ohne Datum ist
    /// kein Eintrag von 1970 — dieselbe Regel wie in der Datenbank.
    var effectiveDate: Date? {
        if let watchedOn, let day = LiveFilmEntryRepository.dayFormatter.date(from: watchedOn) {
            return day
        }
        return FeedEntry.timestamp(from: createdAt)
    }

    /// Ob das Datum geraten ist. Die Zeile sagt es dann dazu.
    var hasWatchedDate: Bool { watchedOn != nil }

    enum CodingKeys: String, CodingKey {
        case id, rating, review, visibility
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case runtimeMinutes = "runtime_min"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case watchedOn = "watched_on"
        case isRewatch = "is_rewatch"
        case createdAt = "created_at"
        case genreIDs = "genre_ids"
        case genreLabels = "genre_labels"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        filmID = try c.decode(String.self, forKey: .filmID)
        titleDE = try c.decodeIfPresent(String.self, forKey: .titleDE)
        titleOriginal = try c.decode(String.self, forKey: .titleOriginal)
        releaseYear = try c.decodeIfPresent(Int.self, forKey: .releaseYear)
        runtimeMinutes = try c.decodeIfPresent(Int.self, forKey: .runtimeMinutes)
        posterSource = try c.decodeIfPresent(String.self, forKey: .posterSource)
        posterURL = try c.decodeIfPresent(String.self, forKey: .posterURL)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating)
        review = try c.decodeIfPresent(String.self, forKey: .review)
        watchedOn = try c.decodeIfPresent(String.self, forKey: .watchedOn)
        isRewatch = (try? c.decode(Bool.self, forKey: .isRewatch)) ?? false
        visibility =
            (try? c.decode(EntryVisibility.self, forKey: .visibility)) ?? .publicly
        createdAt = try c.decode(String.self, forKey: .createdAt)
        genreIDs = (try? c.decode([String].self, forKey: .genreIDs)) ?? []
        genreLabels = (try? c.decode([String].self, forKey: .genreLabels)) ?? []
    }
}

/// Die Zahlen über dem Tagebuch.
struct DiarySummary: Decodable, Sendable {
    let entries: Int
    let films: Int
    let thisYear: Int
    /// Auf der internen Skala 1 bis 10.
    let average: Double?

    static let none = DiarySummary(entries: 0, films: 0, thisYear: 0, average: nil)

    init(entries: Int, films: Int, thisYear: Int, average: Double?) {
        self.entries = entries
        self.films = films
        self.thisYear = thisYear
        self.average = average
    }

    enum CodingKeys: String, CodingKey {
        case entries, films, average
        case thisYear = "this_year"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        entries = (try? c.decode(Int.self, forKey: .entries)) ?? 0
        films = (try? c.decode(Int.self, forKey: .films)) ?? 0
        thisYear = (try? c.decode(Int.self, forKey: .thisYear)) ?? 0
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try? c.decodeIfPresent(Double.self, forKey: .average)
        }
    }
}

/// Wonach das Tagebuch sortiert wird.
enum DiaryOrder: String, CaseIterable, Identifiable, Sendable {
    case newest
    case oldest
    case bestRated
    case worstRated

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newest: return "Zuletzt gesehen"
        case .oldest: return "Zuerst gesehen"
        case .bestRated: return "Beste Bewertung"
        case .worstRated: return "Niedrigste Bewertung"
        }
    }

    /// Fehlende Angaben stehen in jeder Richtung hinten — dieselbe Regel
    /// wie in der Watchlist.
    func sorts(_ a: DiaryEntry, _ b: DiaryEntry) -> Bool {
        switch self {
        case .newest:
            return WatchlistOrder.compare(
                a.effectiveDate?.timeIntervalSince1970, b.effectiveDate?.timeIntervalSince1970,
                ascending: false)
        case .oldest:
            return WatchlistOrder.compare(
                a.effectiveDate?.timeIntervalSince1970, b.effectiveDate?.timeIntervalSince1970,
                ascending: true)
        case .bestRated:
            return WatchlistOrder.compare(
                a.rating.map(Double.init), b.rating.map(Double.init), ascending: false)
        case .worstRated:
            return WatchlistOrder.compare(
                a.rating.map(Double.init), b.rating.map(Double.init), ascending: true)
        }
    }
}

extension LiveFilmEntryRepository {
    private struct EntryUpdate: Encodable {
        let rating: Int
        let watched_on: String?
        let review: String?
        let visibility: String
    }

    /// Das eigene Tagebuch, in einer Anfrage.
    func diary() async -> [DiaryEntry] {
        let rows: [DiaryEntry]? = try? await backend.client
            .rpc("diary_for_me")
            .execute()
            .value
        return rows ?? []
    }

    func diarySummary() async -> DiarySummary {
        let rows: [DiarySummary]? = try? await backend.client
            .rpc("diary_summary")
            .execute()
            .value
        return rows?.first ?? .none
    }

    /// Einen bestimmten Eintrag ändern.
    ///
    /// **Über die Id und nicht über den Film.** Ein Wiedersehen ist ein
    /// zweiter Eintrag zum selben Film; wer hier nach `film_id` schriebe,
    /// änderte den falschen.
    func updateEntry(
        id: UUID, rating: Int, watchedOn: Date?, review: String?, visibility: EntryVisibility
    ) async -> SaveOutcome {
        guard (1...10).contains(rating) else {
            return .failed("Wähl eine Bewertung von einem halben bis fünf Popcorn.")
        }

        let day = watchedOn.map { LiveFilmEntryRepository.dayFormatter.string(from: $0) }
        let text = review?.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            try await backend.client
                .from("diary_entries")
                .update(
                    EntryUpdate(
                        rating: rating, watched_on: day,
                        review: (text?.isEmpty ?? true) ? nil : text,
                        visibility: visibility.rawValue)
                )
                .eq("id", value: id)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func deleteEntry(id: UUID) async -> SaveOutcome {
        do {
            try await backend.client.from("diary_entries").delete().eq("id", value: id).execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}
