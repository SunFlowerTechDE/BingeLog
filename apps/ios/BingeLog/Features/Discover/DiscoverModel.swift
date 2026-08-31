import Foundation

/// Was auf der Entdecken-Seite steht, und ob es schon da ist.
@Observable
@MainActor
final class DiscoverModel {
    private(set) var tiles: [GenreTile] = []
    private(set) var top: [WeeklyTopFilm] = []
    private(set) var feed: [FeedEntry] = []
    private(set) var newest: [Film] = []
    private(set) var isLoading = true

    let avatarBase: URL?

    private let repository: DiscoverRepository

    init(repository: DiscoverRepository) {
        self.repository = repository
        self.avatarBase = repository.avatarBase()
    }

    /// Alle drei Bereiche nebeneinander holen.
    ///
    /// Nacheinander wäre die Seite so langsam wie die Summe; die drei
    /// Abfragen wissen nichts voneinander.
    func load() async {
        async let tiles = repository.genreTiles(limit: 16)
        async let top = repository.weeklyTop(limit: 10)
        async let feed = repository.followingFeed(limit: 20)
        async let newest = repository.newestFilms(limit: 12)

        self.tiles = await tiles
        self.top = await top
        self.feed = await feed
        self.newest = await newest
        isLoading = false
    }
}
