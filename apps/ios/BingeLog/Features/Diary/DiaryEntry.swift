import Foundation
import Supabase

/// Ein Eintrag im eigenen Tagebuch.
nonisolated struct DiaryEntry: Decodable, Identifiable, Sendable {
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
    let hasSpoilers: Bool
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

    /// Wann der Eintrag geschrieben wurde.
    var createdDate: Date? { FeedEntry.timestamp(from: createdAt) }

    /// Ob Sehdatum und Eintragszeitpunkt auseinanderliegen.
    ///
    /// Nur dann steht „eingetragen am" klein darunter. Bei einem Film,
    /// den man am selben Abend einträgt, wäre die Zeile Lärm.
    var wasLoggedLater: Bool {
        guard let watched = effectiveDate, let created = createdDate, hasWatchedDate else {
            return false
        }
        return !Calendar.current.isDate(watched, inSameDayAs: created)
    }

    enum CodingKeys: String, CodingKey {
        case id, rating, review, visibility
        case hasSpoilers = "has_spoilers"
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
        hasSpoilers = (try? c.decode(Bool.self, forKey: .hasSpoilers)) ?? false
        watchedOn = try c.decodeIfPresent(String.self, forKey: .watchedOn)
        isRewatch = (try? c.decode(Bool.self, forKey: .isRewatch)) ?? false
        visibility =
            (try? c.decode(EntryVisibility.self, forKey: .visibility)) ?? .publicly
        createdAt = try c.decode(String.self, forKey: .createdAt)
        genreIDs = (try? c.decode([String].self, forKey: .genreIDs)) ?? []
        genreLabels = (try? c.decode([String].self, forKey: .genreLabels)) ?? []
    }
}

extension Array where Element == DiaryEntry {
    /// Die wievielte Sichtung ein Eintrag ist.
    ///
    /// Gezählt wird über alle Einträge zum selben Film, in zeitlicher
    /// Ordnung — „3. Sichtung" sagt mehr als „Wiedergesehen", und jede
    /// Sichtung bleibt ihr eigener Eintrag mit eigener Bewertung.
    ///
    /// Als eigene Funktion, weil sich eine Liste schlecht prüfen lässt,
    /// das Zählen aber gut.
    func viewingNumbers() -> [UUID: Int] {
        var byFilm: [String: [DiaryEntry]] = [:]
        for entry in self { byFilm[entry.filmID, default: []].append(entry) }

        var out: [UUID: Int] = [:]
        for (_, entries) in byFilm {
            // Die ältesten zuerst: die erste Sichtung ist die erste.
            let ordered = entries.sorted { a, b in
                let x = a.effectiveDate ?? .distantPast
                let y = b.effectiveDate ?? .distantPast
                if x != y { return x < y }
                return a.createdAt < b.createdAt
            }
            for (index, entry) in ordered.enumerated() { out[entry.id] = index + 1 }
        }
        return out
    }
}

/// Die Zahlen über dem Tagebuch.
nonisolated struct DiarySummary: Decodable, Sendable {
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
nonisolated enum DiaryOrder: String, CaseIterable, Identifiable, Sendable {
    case newest
    case oldest
    case bestRated
    case worstRated
    case alphabetical
    case releaseYear
    case lastLogged

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newest: return "Zuletzt gesehen"
        case .oldest: return "Zuerst gesehen"
        case .bestRated: return "Beste Bewertung"
        case .worstRated: return "Niedrigste Bewertung"
        case .alphabetical: return "Alphabetisch"
        case .releaseYear: return "Erscheinungsjahr"
        case .lastLogged: return "Zuletzt eingetragen"
        }
    }

    /// Nur bei diesen dreien ergeben Monatsüberschriften einen Sinn.
    ///
    /// Nach Bewertung oder Titel gruppiert stünden Monate über
    /// Einträgen, die nichts miteinander zu tun haben.
    var groupsByMonth: Bool {
        self == .newest || self == .oldest || self == .lastLogged
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
        case .alphabetical:
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        case .releaseYear:
            return WatchlistOrder.compare(
                a.releaseYear.map(Double.init), b.releaseYear.map(Double.init), ascending: false)
        case .lastLogged:
            // Eingetragen am, nicht gesehen am. Das Konzept verlangt
            // ausdrücklich, dass die beiden getrennt bleiben.
            return WatchlistOrder.compare(
                a.createdDate?.timeIntervalSince1970, b.createdDate?.timeIntervalSince1970,
                ascending: false)
        }
    }
}

extension LiveFilmEntryRepository {
    nonisolated private struct EntryUpdate: Encodable {
        let rating: Int
        let watched_on: String?
        let review: String?
        let has_spoilers: Bool
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
        id: UUID, rating: Int, watchedOn: Date?, review: String?, hasSpoilers: Bool,
        visibility: EntryVisibility
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
                        // Ohne Rezension gibt es nichts zu verdecken.
                        has_spoilers: (text?.isEmpty ?? true) ? false : hasSpoilers,
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
