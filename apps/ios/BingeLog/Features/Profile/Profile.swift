import Foundation
import Supabase

/// Der Kopf eines Profils samt Beziehung zum Betrachter.
nonisolated struct ProfileOverview: Decodable, Sendable {
    let id: UUID
    let username: String
    let displayName: String?
    let bio: String?
    let avatarPath: String?
    let bannerPath: String?
    let createdAt: String
    let followers: Int
    let following: Int
    let isMe: Bool
    let iFollow: Bool
    let followsMe: Bool
    let blockedMe: Bool

    /// Der Name, der oben steht.
    var title: String { displayName ?? username }

    /// Beidseitig heisst befreundet — dieselbe Regel wie in
    /// `are_friends`.
    var areFriends: Bool { iFollow && followsMe }

    var joined: Date? { FeedEntry.timestamp(from: createdAt) }

    /// Dieselben Angaben, nur mit anderem Folgen-Zustand.
    ///
    /// Für das sofortige Umlegen des Knopfes, bevor der Server geantwortet
    /// hat.
    func following(_ iFollow: Bool, followerDelta: Int) -> ProfileOverview {
        ProfileOverview(
            id: id, username: username, displayName: displayName, bio: bio,
            avatarPath: avatarPath, bannerPath: bannerPath, createdAt: createdAt,
            followers: max(0, followers + followerDelta), following: following,
            isMe: isMe, iFollow: iFollow, followsMe: followsMe, blockedMe: blockedMe)
    }

    enum CodingKeys: String, CodingKey {
        case id, username, bio, followers, following
        case displayName = "display_name"
        case avatarPath = "avatar_path"
        case bannerPath = "banner_path"
        case createdAt = "created_at"
        case isMe = "is_me"
        case iFollow = "i_follow"
        case followsMe = "follows_me"
        case blockedMe = "blocked_me"
    }
}

/// Die Zahlen unter dem Kopf.
nonisolated struct ProfileStats: Decodable, Sendable {
    let films: Int
    let ratings: Int
    /// Auf der internen Skala 1 bis 10.
    let average: Double?
    let reviews: Int

    static let none = ProfileStats(films: 0, ratings: 0, average: nil, reviews: 0)

    init(films: Int, ratings: Int, average: Double?, reviews: Int) {
        self.films = films
        self.ratings = ratings
        self.average = average
        self.reviews = reviews
    }

    enum CodingKeys: String, CodingKey { case films, ratings, average, reviews }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        films = (try? c.decode(Int.self, forKey: .films)) ?? 0
        ratings = (try? c.decode(Int.self, forKey: .ratings)) ?? 0
        reviews = (try? c.decode(Int.self, forKey: .reviews)) ?? 0
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try? c.decodeIfPresent(Double.self, forKey: .average)
        }
    }
}

/// Einer der vier Favoritenplätze.
nonisolated struct FavouriteSlot: Decodable, Identifiable, Sendable {
    let slot: Int
    let wikidataID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let posterSource: String?
    let posterURL: String?

    var id: Int { slot }

    var film: Film {
        Film(
            wikidataID: wikidataID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    enum CodingKeys: String, CodingKey {
        case slot
        case wikidataID = "wikidata_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
    }
}

/// Eine Binge-Liste.
nonisolated struct BingeList: Decodable, Identifiable, Sendable {
    let id: UUID
    let title: String
    let description: String?
    let isPublic: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, description
        case isPublic = "is_public"
    }
}

/// Ein Genre, das jemand oft sieht.
nonisolated struct ProfileGenre: Decodable, Identifiable, Sendable {
    let genreID: String
    let label: String
    let films: Int

    var id: String { genreID }
    var shortLabel: String { GenreLabel.short(for: genreID) ?? label }

    enum CodingKeys: String, CodingKey {
        case label, films
        case genreID = "genre_id"
    }
}

/// Ein fremdes oder das eigene Profil lesen.
protocol ProfilePageRepository: Sendable {
    func overview(username: String) async -> ProfileOverview?
    func stats(for id: UUID) async -> ProfileStats
    func favourites(for id: UUID) async -> [FavouriteSlot]
    func lists(for id: UUID) async -> [BingeList]
    func topGenres(for id: UUID) async -> [ProfileGenre]
    func recentEntries(for id: UUID, limit: Int) async -> [FeedEntry]
    /// Gibt zurück, wie der Zustand danach ist — auch im Fehlerfall.
    func setFollow(_ id: UUID, on: Bool) async -> Bool
    func avatarBase() -> URL?
    func bannerBase() -> URL?
}
