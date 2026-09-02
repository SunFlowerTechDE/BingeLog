import Foundation
import Supabase

/// Eine Rezension eines anderen.
struct FilmReview: Decodable, Identifiable, Sendable {
    let id: UUID
    let rating: Int?
    let review: String
    let hasSpoilers: Bool
    let watchedOn: String?
    let isRewatch: Bool
    let createdAt: String
    let username: String?
    /// Das Konto ist gelöscht: Wertung und Text bleiben, der Name geht.
    let accountDeleted: Bool

    var created: Date? { FeedEntry.timestamp(from: createdAt) }

    private struct Profile: Decodable {
        let username: String
        let deletedAt: String?

        enum CodingKeys: String, CodingKey {
            case username
            case deletedAt = "deleted_at"
        }
    }

    enum CodingKeys: String, CodingKey {
        case id, rating, review, profiles
        case hasSpoilers = "has_spoilers"
        case watchedOn = "watched_on"
        case isRewatch = "is_rewatch"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(UUID.self, forKey: .id)
        rating = try c.decodeIfPresent(Int.self, forKey: .rating)
        review = try c.decode(String.self, forKey: .review)
        hasSpoilers = (try? c.decode(Bool.self, forKey: .hasSpoilers)) ?? false
        watchedOn = try c.decodeIfPresent(String.self, forKey: .watchedOn)
        isRewatch = (try? c.decode(Bool.self, forKey: .isRewatch)) ?? false
        createdAt = try c.decode(String.self, forKey: .createdAt)
        let profile = (try? c.decodeIfPresent(Profile.self, forKey: .profiles)) ?? nil
        username = profile?.username
        accountDeleted = profile?.deletedAt != nil
    }
}

extension LiveFilmEntryRepository {
    /// Was die anderen geschrieben haben.
    ///
    /// **Kein Filter auf die Sichtbarkeit hier.** Was zurückkommt,
    /// entscheidet die Policy auf `diary_entries`: öffentlich sieht
    /// jeder, „nur für Freunde" nur bei beidseitigem Folgen, privat
    /// niemand. Ein zweiter Filter im Client wäre eine zweite Wahrheit
    /// (ADR-010).
    func reviews(for filmID: String, limit: Int = 10) async -> [FilmReview] {
        let rows: [FilmReview]? = try? await backend.client
            .from("diary_entries")
            .select(
                "id, rating, review, has_spoilers, watched_on, is_rewatch, "
                    + "created_at, profiles(username, deleted_at)")
            .eq("film_id", value: filmID)
            .not("review", operator: .is, value: "null")
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        return rows ?? []
    }
}
