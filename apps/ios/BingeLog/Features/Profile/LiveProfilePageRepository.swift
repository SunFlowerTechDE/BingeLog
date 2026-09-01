import Foundation
import Supabase

struct LiveProfilePageRepository: ProfilePageRepository {
    let backend: Backend

    nonisolated private struct NameArgument: Encodable { let name: String }
    nonisolated private struct ProfileArgument: Encodable { let profile: String }
    nonisolated private struct GenreArguments: Encodable {
        let profile: String
        let max_results: Int
    }
    nonisolated private struct FollowRow: Encodable {
        let follower_id: String
        let followee_id: String
    }

    func overview(username: String) async -> ProfileOverview? {
        let rows: [ProfileOverview]? = try? await backend.client
            .rpc("profile_overview", params: NameArgument(name: username))
            .execute()
            .value
        return rows?.first
    }

    /// Zählt nur, was der Lesende sehen darf.
    ///
    /// `profile_stats` ist `security invoker` — auf dem eigenen Profil
    /// die volle Zahl, auf einem fremden das Öffentliche. Genau so soll
    /// es sein, und deshalb wird hier nichts nachgerechnet.
    func stats(for id: UUID) async -> ProfileStats {
        let rows: [ProfileStats]? = try? await backend.client
            .rpc("profile_stats", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return rows?.first ?? .none
    }

    func favourites(for id: UUID) async -> [FavouriteSlot] {
        let rows: [FavouriteSlot]? = try? await backend.client
            .rpc("profile_favourites", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return rows ?? []
    }

    /// Was die Policy hergibt.
    ///
    /// Fremde sehen nur öffentliche Listen; auf dem eigenen Profil
    /// stehen auch die privaten. Gefiltert wird das in der Datenbank,
    /// nicht hier.
    func lists(for id: UUID) async -> [ListSummary] {
        // Über dieselbe Funktion wie die Listenseite: die Vorschau
        // braucht die Zahl und die drei Plakate, und zwei Wege zu
        // denselben Zeilen ergäben zwei Wahrheiten.
        let rows: [ListSummary]? = try? await backend.client
            .rpc("lists_of", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return rows ?? []
    }

    func topGenres(for id: UUID) async -> [ProfileGenre] {
        let rows: [ProfileGenre]? = try? await backend.client
            .rpc(
                "profile_genres",
                params: GenreArguments(profile: id.uuidString, max_results: 4)
            )
            .execute()
            .value
        return rows ?? []
    }

    /// Die jüngsten Einträge dieses Profils.
    ///
    /// Über `following_feed` geht das nicht — die Funktion liefert die
    /// gefolgten Profile, nicht ein bestimmtes. Also direkt, und was
    /// sichtbar ist, entscheidet wieder die Policy auf `diary_entries`.
    func recentEntries(for id: UUID, limit: Int) async -> [FeedEntry] {
        let rows: [FeedEntry]? = try? await backend.client
            .from("diary_entries")
            .select(
                "id, created_at, rating, review, has_spoilers, watched_on, is_rewatch, "
                    + "profiles(username, avatar_path), "
                    + "films(wikidata_id, title_de, title_original, release_year, "
                    + "poster_source, poster_url)"
            )
            .eq("user_id", value: id)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        return rows ?? []
    }

    func setFollow(_ id: UUID, on: Bool) async -> Bool {
        guard let user = backend.client.auth.currentUser else { return !on }
        do {
            if on {
                try await backend.client
                    .from("follows")
                    .upsert(
                        FollowRow(
                            follower_id: user.id.uuidString, followee_id: id.uuidString),
                        onConflict: "follower_id,followee_id"
                    )
                    .execute()
            } else {
                try await backend.client
                    .from("follows")
                    .delete()
                    .eq("follower_id", value: user.id)
                    .eq("followee_id", value: id)
                    .execute()
            }
            return on
        } catch {
            return !on
        }
    }

    // ----------------------------------------------------------------
    // Die Auswertungen
    // ----------------------------------------------------------------

    nonisolated private struct YearRow: Decodable { let year: Int; let films: Int }
    nonisolated private struct SpreadRow: Decodable { let rating: String; let films: Int }
    nonisolated private struct DecadeRow: Decodable { let decade: Int; let films: Int }
    nonisolated private struct NameRow: Decodable { let name: String; let films: Int }
    nonisolated private struct WatchedRow: Decodable { let films: WatchlistPreviewItem }
    nonisolated private struct BlockRow: Encodable {
        let blocker_id: String
        let blocked_id: String
    }

    func years(for id: UUID) async -> [ProfileBar] {
        let rows: [YearRow]? = try? await backend.client
            .rpc("profile_years", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return (rows ?? []).map { ProfileBar(label: String($0.year), films: $0.films) }
    }

    /// Die Verteilung der eigenen Noten.
    ///
    /// `rating` kommt als `numeric`, also als Zeichenkette, und steht auf
    /// der internen Skala 1 bis 10. Beschriftet wird in Popcorn — hier
    /// wird **einmal** halbiert.
    func ratingSpread(for id: UUID) async -> [ProfileBar] {
        let rows: [SpreadRow]? = try? await backend.client
            .rpc("profile_rating_spread", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return (rows ?? []).map {
            ProfileBar(label: Popcorn.format(Double($0.rating) ?? 0), films: $0.films)
        }
    }

    func decades(for id: UUID) async -> [ProfileBar] {
        let rows: [DecadeRow]? = try? await backend.client
            .rpc("profile_decades", params: ProfileArgument(profile: id.uuidString))
            .execute()
            .value
        return (rows ?? []).map { ProfileBar(label: "\($0.decade)er", films: $0.films) }
    }

    func directors(for id: UUID) async -> [ProfileBar] {
        let rows: [NameRow]? = try? await backend.client
            .rpc(
                "profile_directors",
                params: GenreArguments(profile: id.uuidString, max_results: 5)
            )
            .execute()
            .value
        return (rows ?? []).map { ProfileBar(label: $0.name, films: $0.films) }
    }

    // ----------------------------------------------------------------
    // Watchlist
    // ----------------------------------------------------------------
    //
    // Ob ein fremder etwas zu sehen bekommt, entscheidet die Policy auf
    // `watchlist` — sie prueft `profiles.watchlist_public`. Hier wird
    // gefragt, nicht selbst gefiltert.

    func watchlistPreview(for id: UUID, limit: Int) async -> [WatchlistPreviewItem] {
        let rows: [WatchedRow]? = try? await backend.client
            .from("watchlist")
            .select(
                "films(wikidata_id, title_de, title_original, release_year, "
                    + "poster_source, poster_url)"
            )
            .eq("user_id", value: id)
            .order("added_at", ascending: false)
            .limit(limit)
            .execute()
            .value
        return (rows ?? []).map(\.films)
    }

    func watchlistCount(for id: UUID) async -> Int {
        let rows: [WatchedRow]? = try? await backend.client
            .from("watchlist")
            .select("films(wikidata_id, title_de, title_original, release_year, "
                + "poster_source, poster_url)")
            .eq("user_id", value: id)
            .execute()
            .value
        return (rows ?? []).count
    }

    /// Blockieren ist einseitig und still: der Blockierte erfährt es
    /// nicht (M4 4.5).
    func setBlock(_ id: UUID, on: Bool) async -> Bool {
        guard let user = backend.client.auth.currentUser else { return !on }
        do {
            if on {
                try await backend.client
                    .from("blocks")
                    .upsert(
                        BlockRow(blocker_id: user.id.uuidString, blocked_id: id.uuidString),
                        onConflict: "blocker_id,blocked_id"
                    )
                    .execute()
            } else {
                try await backend.client
                    .from("blocks")
                    .delete()
                    .eq("blocker_id", value: user.id)
                    .eq("blocked_id", value: id)
                    .execute()
            }
            return on
        } catch {
            return !on
        }
    }

    func avatarBase() -> URL? {
        try? backend.client.storage.from("avatars").getPublicURL(path: "")
    }

    func bannerBase() -> URL? {
        try? backend.client.storage.from("banners").getPublicURL(path: "")
    }
}
