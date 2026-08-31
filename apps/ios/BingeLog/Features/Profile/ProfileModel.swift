import Foundation
import SwiftUI

/// Alles, was auf einem Profil steht.
@Observable
@MainActor
final class ProfileModel {
    let username: String

    private(set) var overview: ProfileOverview?
    private(set) var stats = ProfileStats.none
    private(set) var favourites: [FavouriteSlot] = []
    private(set) var lists: [BingeList] = []
    private(set) var genres: [ProfileGenre] = []
    private(set) var recent: [FeedEntry] = []
    private(set) var isLoading = true
    private(set) var isMissing = false

    let avatarBase: URL?
    let bannerBase: URL?

    private let repository: ProfilePageRepository

    init(username: String, repository: ProfilePageRepository) {
        self.username = username
        self.repository = repository
        self.avatarBase = repository.avatarBase()
        self.bannerBase = repository.bannerBase()
    }

    func load() async {
        // Zuerst der Kopf: ohne ihn gibt es keine Id, mit der sich das
        // Übrige holen liesse.
        guard let head = await repository.overview(username: username) else {
            isMissing = true
            isLoading = false
            return
        }
        overview = head

        // Wer blockiert hat, bekommt nichts zu sehen. Die Policy gibt
        // ohnehin nichts heraus — hier wird nur nicht danach gefragt.
        guard !head.blockedMe else {
            isLoading = false
            return
        }

        async let stats = repository.stats(for: head.id)
        async let favourites = repository.favourites(for: head.id)
        async let lists = repository.lists(for: head.id)
        async let genres = repository.topGenres(for: head.id)
        async let recent = repository.recentEntries(for: head.id, limit: 6)

        self.stats = await stats
        self.favourites = await favourites
        self.lists = await lists
        self.genres = await genres
        self.recent = await recent
        isLoading = false
    }

    /// Sofort umlegen, dann sagen lassen, ob es geklappt hat.
    func toggleFollow() async {
        guard let head = overview else { return }
        let wanted = !head.iFollow
        apply(iFollow: wanted, followerDelta: wanted ? 1 : -1)

        let actual = await repository.setFollow(head.id, on: wanted)
        if actual != wanted {
            apply(iFollow: actual, followerDelta: actual ? 1 : -1)
        }
    }

    private func apply(iFollow: Bool, followerDelta: Int) {
        overview = overview?.following(iFollow, followerDelta: followerDelta)
    }
}
