import Foundation
import Supabase

/// Was die Entdecken-Seite braucht.
protocol DiscoverRepository: Sendable {
    func genreTiles(limit: Int) async -> [GenreTile]
    func newestFilms(limit: Int) async -> [Film]
    func followingFeed(limit: Int) async -> [FeedEntry]
    /// Wo die Profilbilder liegen. Einmal gefragt, nicht je Zeile.
    func avatarBase() -> URL?
    /// Die Filme eines Genres, hinter der Kachel.
    func films(inGenre genreID: String, limit: Int) async -> [Film]
}

struct LiveDiscoverRepository: DiscoverRepository {
    let backend: Backend

    private struct TileArguments: Encodable {
        let max_results: Int
    }

    private struct FeedArguments: Encodable {
        let max_results: Int
    }

    /// Die Kacheln kommen aus `genre_tiles`, nicht aus einer Abfrage
    /// hier.
    ///
    /// Dieselbe Regel wie bei der Suche: die Schwelle — ab drei Filmen —
    /// und die Rangfolge stehen in der Datenbank. Ein zweiter Client,
    /// der sie nachbaut, baut sie leicht anders, und dann zeigt das
    /// iPhone andere Kacheln als der Browser.
    func genreTiles(limit: Int = 16) async -> [GenreTile] {
        let tiles: [GenreTile]? = try? await backend.client
            .rpc("genre_tiles", params: TileArguments(max_results: limit))
            .execute()
            .value
        return tiles ?? []
    }

    /// Das Neueste im Katalog, nach Erscheinungsjahr.
    ///
    /// `gt(0)` statt „nicht null": Filme ohne Jahr gehören nicht in eine
    /// Liste, die nach Jahr sortiert ist, und ein Jahr größer null hat
    /// jeder, der eins hat. Bei Gleichstand die bekannteren zuerst —
    /// `sitelink_count` ist das einzige Maß für Bekanntheit, das der
    /// Katalog kennt.
    func newestFilms(limit: Int = 12) async -> [Film] {
        let films: [Film]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .gt("release_year", value: 0)
            .order("release_year", ascending: false)
            .order("sitelink_count", ascending: false)
            .limit(limit)
            .execute()
            .value
        return films ?? []
    }

    /// Der Feed der gefolgten Profile.
    ///
    /// **Chronologisch und vollständig**, ohne Gewichtung — das ist ein
    /// Produktversprechen und kein Implementierungsdetail (M4 4.4). Was
    /// darin sichtbar ist, entscheidet die Policy auf `diary_entries`;
    /// die Funktion ist `security invoker`, damit die Trennung zwischen
    /// öffentlich, nur für Freunde und privat auch hier gilt.
    func followingFeed(limit: Int = 20) async -> [FeedEntry] {
        let entries: [FeedEntry]? = try? await backend.client
            .rpc("following_feed", params: FeedArguments(max_results: limit))
            .execute()
            .value
        return entries ?? []
    }

    func avatarBase() -> URL? {
        try? backend.client.storage.from("avatars").getPublicURL(path: "")
    }

    private struct GenreLink: Decodable {
        let film_id: String
    }

    /// Zwei Abfragen statt eines Joins.
    ///
    /// PostgREST kann den Join, aber das Ergebnis kommt verschachtelt
    /// zurück und braucht ein zweites Modell, das es sonst nirgends
    /// gibt. Zwei schlichte Abfragen auf indizierte Spalten sind hier
    /// billiger als ein Modell, das nur dieser einen Stelle dient.
    func films(inGenre genreID: String, limit: Int = 60) async -> [Film] {
        let links: [GenreLink]? = try? await backend.client
            .from("film_genres")
            .select("film_id")
            .eq("genre_id", value: genreID)
            .limit(limit)
            .execute()
            .value

        let ids = (links ?? []).map(\.film_id)
        guard !ids.isEmpty else { return [] }

        let films: [Film]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .in("wikidata_id", values: ids)
            .order("sitelink_count", ascending: false)
            .execute()
            .value
        return films ?? []
    }
}
