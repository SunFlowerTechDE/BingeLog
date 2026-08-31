import Foundation
import Supabase

/// Was die Entdecken-Seite braucht.
protocol DiscoverRepository: Sendable {
    func genreTiles(limit: Int) async -> [GenreTile]
    func newestFilms(limit: Int) async -> [Film]
    /// Die Rangliste der laufenden Woche.
    func weeklyTop(limit: Int) async -> [WeeklyTopFilm]
    /// Vorschläge aus den eigenen guten Bewertungen.
    func forMe(limit: Int) async -> [Film]
    /// Filme, deren Erscheinungsjahr noch aussteht.
    func upcoming(limit: Int) async -> [Film]
    func followingFeed(limit: Int) async -> [FeedEntry]
    /// Wo die Profilbilder liegen. Einmal gefragt, nicht je Zeile.
    func avatarBase() -> URL?
    /// Die Filme eines Genres, hinter der Kachel.
    func films(inGenre genreID: String, limit: Int) async -> [Film]
}

struct LiveDiscoverRepository: DiscoverRepository {
    let backend: Backend

    nonisolated private struct TileArguments: Encodable {
        let max_results: Int
    }

    nonisolated private struct FeedArguments: Encodable {
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
            // Nicht in die Zukunft: was noch nicht erschienen ist,
            // steht unter „Bald verfügbar" und ist nicht „neu".
            .lte("release_year", value: Calendar(identifier: .gregorian).component(
                .year, from: Date()))
            .order("release_year", ascending: false)
            .order("sitelink_count", ascending: false)
            .limit(limit)
            .execute()
            .value
        return films ?? []
    }

    /// Die meistbewerteten Filme der laufenden Woche.
    ///
    /// Der Zeitraum — Montag 00:00 bis Sonntag 23:59, deutsche Zeit —
    /// steht in `weekly_top_films` und nicht hier. Ein Client, der die
    /// Wochengrenze selbst zieht, zieht sie in seiner eigenen Zeitzone,
    /// und dann steht auf dem iPhone eine andere Zehn als im Browser.
    func weeklyTop(limit: Int = 10) async -> [WeeklyTopFilm] {
        let rows: [WeeklyTopFilm]? = try? await backend.client
            .rpc("weekly_top_films", params: TileArguments(max_results: limit))
            .execute()
            .value
        return rows ?? []
    }

    /// Vorschläge aus dem eigenen Geschmack.
    ///
    /// Gerechnet wird in `films_for_me`, nicht hier: eine Empfehlung,
    /// die im Browser anders ausfällt als auf dem iPhone, ist keine.
    /// Ohne Anmeldung und ohne eigene Bewertungen kommt nichts zurück,
    /// und die Ansicht blendet den Bereich dann aus.
    func forMe(limit: Int = 12) async -> [Film] {
        let films: [Film]? = try? await backend.client
            .rpc("films_for_me", params: TileArguments(max_results: limit))
            .execute()
            .value
        return films ?? []
    }

    /// Was noch kommt.
    ///
    /// **Nach Jahr und nicht nach Datum.** Der Katalog führt
    /// `release_year`, kein Erscheinungsdatum — ein „noch 12 Tage", wie
    /// das Konzept es vorschlägt, wäre erfunden. Bis das Datum da ist,
    /// steht hier das Jahr.
    func upcoming(limit: Int = 12) async -> [Film] {
        let year = Calendar(identifier: .gregorian).component(.year, from: Date())
        let films: [Film]? = try? await backend.client
            .from("films")
            .select("wikidata_id, title_de, title_original, release_year, poster_source, poster_url")
            .gt("release_year", value: year)
            .order("release_year", ascending: true)
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

    nonisolated private struct GenreLink: Decodable {
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
