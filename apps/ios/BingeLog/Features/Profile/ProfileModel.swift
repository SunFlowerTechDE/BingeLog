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

    // Die vier Auswertungen und die Watchlist.
    private(set) var years: [ProfileBar] = []
    private(set) var spread: [ProfileBar] = []
    private(set) var decades: [ProfileBar] = []
    private(set) var directors: [ProfileBar] = []
    private(set) var watchlist: [WatchlistPreviewItem] = []
    private(set) var watchlistCount = 0

    /// Die Zahlen erscheinen erst, wenn sie etwas sagen.
    ///
    /// Ein Balkendiagramm mit einem Balken ist kein Diagramm, und eine
    /// Verteilung aus drei Bewertungen ist keine Verteilung — dieselbe
    /// Regel wie im Web.
    var hasCharts: Bool {
        years.count > 1 || decades.count > 1 || spread.contains { $0.films > 0 }
            || !directors.isEmpty
    }
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
        async let years = repository.years(for: head.id)
        async let spread = repository.ratingSpread(for: head.id)
        async let decades = repository.decades(for: head.id)
        async let directors = repository.directors(for: head.id)
        async let watchlist = repository.watchlistPreview(for: head.id, limit: 6)
        async let watchlistCount = repository.watchlistCount(for: head.id)

        self.stats = await stats
        self.favourites = await favourites
        self.lists = await lists
        self.genres = await genres
        self.recent = await recent
        self.years = await years
        self.spread = await spread
        self.decades = await decades
        self.directors = await directors
        self.watchlist = await watchlist
        self.watchlistCount = await watchlistCount
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

    /// Blockieren und wieder freigeben.
    ///
    /// Danach neu laden: wer blockiert, folgt nicht mehr, und die Seite
    /// zeigt von da an nichts mehr — beides entscheidet die Datenbank,
    /// nicht diese Ansicht.
    func toggleBlock() async {
        guard let head = overview else { return }
        _ = await repository.setBlock(head.id, on: !head.iBlocked)
        await load()
    }

    private func apply(iFollow: Bool, followerDelta: Int) {
        overview = overview?.following(iFollow, followerDelta: followerDelta)
    }
}
