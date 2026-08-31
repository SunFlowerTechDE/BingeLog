import Foundation
import Supabase

/// Wer den Eintrag sehen darf.
///
/// Dieselben drei Stufen wie in der Datenbank (`entry_visibility`). Was
/// sie bedeuten, entscheidet die Policy auf `diary_entries` — nicht
/// diese Aufzählung und nicht die Oberfläche (ADR-010).
enum EntryVisibility: String, Codable, CaseIterable, Sendable {
    case publicly = "public"
    case friends
    case privately = "private"

    var label: String {
        switch self {
        case .publicly: return "Öffentlich"
        case .friends: return "Nur für Freunde"
        case .privately: return "Nur für mich"
        }
    }
}

/// Der eigene Eintrag zu einem Film — der jüngste.
struct OwnEntry: Decodable, Equatable, Sendable {
    let id: UUID
    let rating: Int?
    let watchedOn: String?
    let review: String?
    let isRewatch: Bool
    let visibility: EntryVisibility

    enum CodingKeys: String, CodingKey {
        case id, rating, review, visibility
        case watchedOn = "watched_on"
        case isRewatch = "is_rewatch"
    }
}

/// Was auf der Filmseite über die Allgemeinheit steht.
struct RatingSummary: Decodable, Equatable, Sendable {
    /// Auf der internen Skala 1 bis 10, oder `nil`, wenn noch niemand
    /// bewertet hat.
    let average: Double?
    let votes: Int

    enum CodingKeys: String, CodingKey { case average, votes }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        votes = (try? c.decode(Int.self, forKey: .votes)) ?? 0
        // `numeric` kommt als Zeichenkette an.
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try? c.decodeIfPresent(Double.self, forKey: .average)
        }
    }

    init(average: Double?, votes: Int) {
        self.average = average
        self.votes = votes
    }
}

/// Was der Nutzer auf der Filmseite tut.
protocol FilmEntryRepository: Sendable {
    func summary(for filmID: String) async -> RatingSummary
    func ownEntry(for filmID: String) async -> OwnEntry?
    func isOnWatchlist(_ filmID: String) async -> Bool
    func setWatchlist(_ filmID: String, on: Bool) async -> Bool
    func save(
        filmID: String, rating: Int, watchedOn: Date?, review: String?,
        visibility: EntryVisibility
    ) async -> EntrySaved

    func ownFacets(for filmID: String) async -> [FacetKind: Int]
    func facetAverages(for filmID: String) async -> [FacetAverage]
    func replaceFacets(entryID: UUID, with scores: [FacetKind: Int]) async
    func reviews(for filmID: String, limit: Int) async -> [FilmReview]
    func thread(for filmID: String) async -> ThreadState
    func discussionThreshold() async -> Int
    func messages(for filmID: String) async -> [ThreadMessage]
    func post(filmID: String, body: String, replyingTo parent: UUID?) async -> SaveOutcome

    func friendsForRecommendation(film: String) async -> [RecommendationTarget]
    func recommend(film: String, to friends: [UUID], note: String?) async -> SaveOutcome
    func recommendationsForMe(limit: Int) async -> [Recommendation]
    func dismissRecommendation(film: String) async

    func watchlist() async -> [WatchlistEntry]
    func statuses(for filmIDs: [String]) async -> FilmStatuses
}

/// Was beim Speichern herauskam.
///
/// Ein eigener Typ statt `Result<Void, String>`: eine Zeichenkette ist
/// kein Fehler, und der Compiler sagt das zu Recht.
enum SaveOutcome: Equatable, Sendable {
    case saved
    case failed(String)
}

/// Was gespeichert wurde — die Zeile, an der die Facetten hängen.
enum EntrySaved: Equatable, Sendable {
    case saved(UUID)
    case failed(String)
}

struct LiveFilmEntryRepository: FilmEntryRepository {
    let backend: Backend

    private struct SummaryArguments: Encodable { let film: String }

    private struct EntryValues: Encodable {
        let rating: Int
        let watched_on: String?
        let review: String?
        let visibility: String
    }

    private struct NewEntry: Encodable {
        let user_id: String
        let film_id: String
        let rating: Int
        let watched_on: String?
        let review: String?
        let visibility: String
    }

    private struct WatchlistRow: Encodable {
        let user_id: String
        let film_id: String
    }

    /// Ein Datum als `yyyy-MM-dd`, wie die Spalte es führt.
    static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .iso8601)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    func summary(for filmID: String) async -> RatingSummary {
        let rows: [RatingSummary]? = try? await backend.client
            .rpc("film_rating_summary", params: SummaryArguments(film: filmID))
            .execute()
            .value
        return rows?.first ?? RatingSummary(average: nil, votes: 0)
    }

    /// Der jüngste eigene Eintrag.
    ///
    /// Gefiltert wird **nicht** nach dem Eigentümer über das, was die
    /// Policy ohnehin durchsetzt: `diary_entries` gibt einem Angemeldeten
    /// seine eigenen Zeilen und die öffentlichen. Deshalb steht hier
    /// trotzdem `user_id` — sonst käme der Eintrag eines Fremden zurück.
    func ownEntry(for filmID: String) async -> OwnEntry? {
        guard let user = backend.client.auth.currentUser else { return nil }

        let rows: [OwnEntry]? = try? await backend.client
            .from("diary_entries")
            .select("id, rating, watched_on, review, is_rewatch, visibility")
            .eq("user_id", value: user.id)
            .eq("film_id", value: filmID)
            .order("created_at", ascending: false)
            .limit(1)
            .execute()
            .value
        return rows?.first
    }

    func isOnWatchlist(_ filmID: String) async -> Bool {
        guard let user = backend.client.auth.currentUser else { return false }
        let rows: [WatchedRow]? = try? await backend.client
            .from("watchlist")
            .select("film_id")
            .eq("user_id", value: user.id)
            .eq("film_id", value: filmID)
            .execute()
            .value
        return !(rows ?? []).isEmpty
    }

    private struct WatchedRow: Decodable { let film_id: String }

    /// Gibt zurück, wie der Zustand danach ist — auch im Fehlerfall.
    ///
    /// Ein Lesezeichen, das umspringt und beim nächsten Öffnen wieder
    /// aus ist, ist schlimmer als eins, das gar nicht erst umspringt.
    func setWatchlist(_ filmID: String, on: Bool) async -> Bool {
        guard let user = backend.client.auth.currentUser else { return !on }

        do {
            if on {
                try await backend.client
                    .from("watchlist")
                    .upsert(
                        WatchlistRow(user_id: user.id.uuidString, film_id: filmID),
                        onConflict: "user_id,film_id"
                    )
                    .execute()
            } else {
                try await backend.client
                    .from("watchlist")
                    .delete()
                    .eq("user_id", value: user.id)
                    .eq("film_id", value: filmID)
                    .execute()
            }
            return on
        } catch {
            return !on
        }
    }

    /// Legt einen Eintrag an oder ändert den bestehenden.
    ///
    /// Geändert und nicht angehängt: eine andere Bewertung zu tippen ist
    /// eine Korrektur, kein zweites Ansehen. Das Wiedersehen ist ein
    /// eigener Weg, und `is_rewatch` setzt ohnehin ein Trigger.
    ///
    /// **Die Bewertung ist Pflicht, die Facetten sind es nicht**
    /// (ADR-009).
    func save(
        filmID: String, rating: Int, watchedOn: Date?, review: String?,
        visibility: EntryVisibility
    ) async -> EntrySaved {
        guard (1...10).contains(rating) else {
            return .failed("Wähl eine Bewertung von einem halben bis fünf Popcorn.")
        }
        guard let user = backend.client.auth.currentUser else {
            return .failed("Melde dich an, um etwas einzutragen.")
        }

        let day = watchedOn.map { LiveFilmEntryRepository.dayFormatter.string(from: $0) }
        let text = review?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleaned = (text?.isEmpty ?? true) ? nil : text

        do {
            if let existing = await ownEntry(for: filmID) {
                try await backend.client
                    .from("diary_entries")
                    .update(
                        EntryValues(
                            rating: rating, watched_on: day, review: cleaned,
                            visibility: visibility.rawValue)
                    )
                    .eq("id", value: existing.id)
                    .execute()
                return .saved(existing.id)
            }

            try await backend.client
                .from("diary_entries")
                .insert(
                    NewEntry(
                        user_id: user.id.uuidString, film_id: filmID, rating: rating,
                        watched_on: day, review: cleaned, visibility: visibility.rawValue)
                )
                .execute()

            // Die neue Zeile noch einmal lesen, statt sie sich ausgeben
            // zu lassen: ein `insert().select()` braucht eine
            // SELECT-Policy, und wenn die fehlt, meldet Postgres einen
            // Verstoss beim Einfügen — der Fehler zeigt dann auf die
            // falsche Hälfte.
            guard let created = await ownEntry(for: filmID) else {
                return .failed("Gespeichert, aber nicht wiedergefunden.")
            }
            return .saved(created.id)
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}

/// Was der Nutzer von einer Handvoll Filme schon kennt.
struct FilmStatuses: Sendable {
    let seen: Set<String>
    let onWatchlist: Set<String>

    static let none = FilmStatuses(seen: [], onWatchlist: [])
}

extension LiveFilmEntryRepository {
    private struct FilmRow: Decodable { let film_id: String }

    /// Zwei Abfragen für die ganze Trefferliste, nicht zwei je Zeile.
    func statuses(for filmIDs: [String]) async -> FilmStatuses {
        guard let user = backend.client.auth.currentUser, !filmIDs.isEmpty else {
            return .none
        }

        async let diary: [FilmRow] =
            (try? await backend.client
                .from("diary_entries")
                .select("film_id")
                .eq("user_id", value: user.id)
                .in("film_id", values: filmIDs)
                .execute()
                .value) ?? []

        async let watchlist: [FilmRow] =
            (try? await backend.client
                .from("watchlist")
                .select("film_id")
                .eq("user_id", value: user.id)
                .in("film_id", values: filmIDs)
                .execute()
                .value) ?? []

        return FilmStatuses(
            seen: Set(await diary.map(\.film_id)),
            onWatchlist: Set(await watchlist.map(\.film_id))
        )
    }
}
