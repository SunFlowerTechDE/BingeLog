import Foundation
import Supabase

/// Ein Film auf der Watchlist, mit allem, was die Seite braucht.
nonisolated struct WatchlistEntry: Decodable, Identifiable, Sendable {
    let filmID: String
    let titleDE: String?
    let titleOriginal: String
    let releaseYear: Int?
    let runtimeMinutes: Int?
    let posterSource: String?
    let posterURL: String?
    let addedAt: String
    /// Der Durchschnitt der Allgemeinheit, Skala 1 bis 10.
    let average: Double?
    let votes: Int
    let genreIDs: [String]
    let genreLabels: [String]
    /// Wie viele Freunde ihn empfohlen haben.
    let recommenders: Int
    let firstFriend: String?
    /// Veraenderlich, weil beides sich am Eintrag umstellen laesst,
    /// ohne dass die ganze Liste neu geholt werden muesste.
    var priority: WatchlistPriority
    /// In welchen eigenen Gruppen er steht.
    var groupIDs: [UUID]
    /// Wie viele Freunde ihn schon gesehen haben.
    let friendsSeen: Int
    let friendName: String?
    /// Die Note dieses Freundes, interne Skala 1 bis 10.
    let friendRating: Int?

    var id: String { filmID }
    var title: String { titleDE ?? titleOriginal }

    var film: Film {
        Film(
            wikidataID: filmID, titleDE: titleDE, titleOriginal: titleOriginal,
            releaseYear: releaseYear, posterSource: posterSource, posterURL: posterURL)
    }

    var added: Date? { FeedEntry.timestamp(from: addedAt) }

    /// Seit wie vielen Tagen er daliegt.
    var daysWaiting: Int? {
        guard let added else { return nil }
        return Calendar.current.dateComponents([.day], from: added, to: Date()).day
    }

    /// „Empfohlen von Pascal" oder „Von 3 Freunden empfohlen".
    var recommendationNote: String? {
        guard recommenders > 0 else { return nil }
        if recommenders == 1, let firstFriend { return "Empfohlen von \(firstFriend)" }
        return "Von \(recommenders) Freunden empfohlen"
    }

    func with(priority level: WatchlistPriority) -> WatchlistEntry {
        var copy = self
        copy.priority = level
        return copy
    }

    func with(group id: UUID) -> WatchlistEntry {
        var copy = self
        if !copy.groupIDs.contains(id) { copy.groupIDs.append(id) }
        return copy
    }

    func without(group id: UUID) -> WatchlistEntry {
        var copy = self
        copy.groupIDs.removeAll { $0 == id }
        return copy
    }

    /// „Sarah gab 4,5 Popcorn" oder „3 Freunde gesehen".
    ///
    /// Bei genau einem Freund der Name: der sagt mehr als eine Eins. Ab
    /// zwei die Zahl, weil eine Aufzählung die Karte sprengt.
    var seenNote: String? {
        guard friendsSeen > 0 else { return nil }
        if friendsSeen == 1, let friendName {
            guard let friendRating else { return "\(friendName) hat ihn gesehen" }
            return "\(friendName) gab \(Popcorn.format(friendRating)) Popcorn"
        }
        return "\(friendsSeen) Freunde gesehen"
    }

    /// Wie stark das soziale Argument für diesen Film ist.
    ///
    /// Drei Stufen, keine Rechnung: an mich gerichtet, im Umfeld
    /// gesehen, nichts.
    var socialWeight: Int {
        if recommenders > 0 { return 2 }
        if friendsSeen > 0 { return 1 }
        return 0
    }

    /// Der eine soziale Hinweis, den die Karte trägt.
    ///
    /// **Nur einer.** Eine Empfehlung ist der stärkere: sie ist an mich
    /// gerichtet, das Gesehenhaben ist es nicht (Konzept: die
    /// Information darf die Karten nicht überladen).
    var socialNote: String? { recommendationNote ?? seenNote }

    /// Genres als Paare, für den Filter.
    var genres: [FilmGenre] {
        zip(genreIDs, genreLabels).map { FilmGenre(id: $0, label: $1) }
    }

    enum CodingKeys: String, CodingKey {
        case votes, average, recommenders
        case filmID = "film_id"
        case titleDE = "title_de"
        case titleOriginal = "title_original"
        case releaseYear = "release_year"
        case runtimeMinutes = "runtime_min"
        case posterSource = "poster_source"
        case posterURL = "poster_url"
        case addedAt = "added_at"
        case genreIDs = "genre_ids"
        case genreLabels = "genre_labels"
        case firstFriend = "first_friend"
        case priority
        case groupIDs = "group_ids"
        case friendsSeen = "friends_seen"
        case friendName = "friend_name"
        case friendRating = "friend_rating"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        filmID = try c.decode(String.self, forKey: .filmID)
        titleDE = try c.decodeIfPresent(String.self, forKey: .titleDE)
        titleOriginal = try c.decode(String.self, forKey: .titleOriginal)
        releaseYear = try c.decodeIfPresent(Int.self, forKey: .releaseYear)
        runtimeMinutes = try c.decodeIfPresent(Int.self, forKey: .runtimeMinutes)
        posterSource = try c.decodeIfPresent(String.self, forKey: .posterSource)
        posterURL = try c.decodeIfPresent(String.self, forKey: .posterURL)
        addedAt = try c.decode(String.self, forKey: .addedAt)
        votes = (try? c.decode(Int.self, forKey: .votes)) ?? 0
        // `numeric` kommt als Zeichenkette an.
        if let text = (try? c.decodeIfPresent(String.self, forKey: .average)) ?? nil {
            average = Double(text)
        } else {
            average = try? c.decodeIfPresent(Double.self, forKey: .average)
        }
        genreIDs = (try? c.decode([String].self, forKey: .genreIDs)) ?? []
        genreLabels = (try? c.decode([String].self, forKey: .genreLabels)) ?? []
        recommenders = (try? c.decode(Int.self, forKey: .recommenders)) ?? 0
        firstFriend = try c.decodeIfPresent(String.self, forKey: .firstFriend)
        // Faellt die Angabe aus, ist der Film normal. Eine Prioritaet,
        // die beim Decodieren scheitert, soll keinen Eintrag verlieren.
        priority =
            (try? c.decode(WatchlistPriority.self, forKey: .priority)) ?? .normal
        groupIDs = (try? c.decode([UUID].self, forKey: .groupIDs)) ?? []
        friendsSeen = (try? c.decode(Int.self, forKey: .friendsSeen)) ?? 0
        friendName = try c.decodeIfPresent(String.self, forKey: .friendName)
        friendRating = try c.decodeIfPresent(Int.self, forKey: .friendRating)
    }
}

/// Wie dringend ein vorgemerkter Film ist (Watchlist-Konzept).
///
/// Drei Stufen und nicht mehr. Wer fuenf hat, sortiert statt zu
/// entscheiden — und die Prioritaet ist die grobe Antwort, die feine
/// sind die Gruppen.
nonisolated enum WatchlistPriority: String, Codable, CaseIterable, Identifiable, Sendable {
    case next
    case normal
    case someday

    var id: String { rawValue }

    var label: String {
        switch self {
        case .next: return "Als Nächstes"
        case .normal: return "Normal"
        case .someday: return "Irgendwann"
        }
    }

    var symbol: String {
        switch self {
        case .next: return "flame"
        case .normal: return "circle"
        case .someday: return "clock"
        }
    }

    /// Die Reihenfolge auf der Seite, dieselbe wie im Enum der Datenbank.
    var rank: Int {
        switch self {
        case .next: return 0
        case .normal: return 1
        case .someday: return 2
        }
    }
}

/// Eine eigene Gruppe, mit der Anzahl ihrer Filme.
nonisolated struct WatchlistGroup: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let name: String
    let films: Int

    enum CodingKeys: String, CodingKey {
        case id, name, films
    }
}

/// Wonach die Watchlist sortiert wird.
nonisolated enum WatchlistOrder: String, CaseIterable, Identifiable, Sendable {
    case newestAdded
    case oldestAdded
    case bestRated
    case worstRated
    case newestFilm
    case oldestFilm
    case shortest
    case longest
    case alphabetical
    case byPriority
    case bestMatch

    var id: String { rawValue }

    var label: String {
        switch self {
        case .newestAdded: return "Zuletzt hinzugefügt"
        case .oldestAdded: return "Zuerst hinzugefügt"
        case .bestRated: return "Beste Bewertung"
        case .worstRated: return "Niedrigste Bewertung"
        case .newestFilm: return "Jahr, neu nach alt"
        case .oldestFilm: return "Jahr, alt nach neu"
        case .shortest: return "Kürzeste Laufzeit"
        case .longest: return "Längste Laufzeit"
        case .alphabetical: return "Alphabetisch"
        case .byPriority: return "Priorität"
        case .bestMatch: return "Beste Übereinstimmung"
        }
    }

    /// Wie zwei Einträge verglichen werden.
    ///
    /// Als eigene Funktion, weil sich eine Liste schlecht prüfen lässt,
    /// die Ordnung dahinter aber gut.
    ///
    /// **Fehlende Angaben stehen immer hinten**, in jeder Richtung. Ein
    /// Film ohne Laufzeit ist nicht der kürzeste, und einer ohne
    /// Bewertung ist nicht der schlechteste.
    func sorts(_ a: WatchlistEntry, _ b: WatchlistEntry) -> Bool {
        sorts(a, b, matches: [:])
    }

    /// Dieselbe Ordnung, aber mit den Übereinstimmungen zur Hand.
    ///
    /// Die Werte kommen aus einer eigenen Anfrage und stehen nicht am
    /// Eintrag — sonst müsste jede Liste, die Einträge lädt, auch das
    /// Geschmacksprofil mitladen.
    func sorts(
        _ a: WatchlistEntry, _ b: WatchlistEntry, matches: [String: Int]
    ) -> Bool {
        switch self {
        case .newestAdded: return a.addedAt > b.addedAt
        case .oldestAdded: return a.addedAt < b.addedAt
        case .bestRated: return WatchlistOrder.compare(a.average, b.average, ascending: false)
        case .worstRated: return WatchlistOrder.compare(a.average, b.average, ascending: true)
        case .newestFilm:
            return WatchlistOrder.compare(
                a.releaseYear.map(Double.init), b.releaseYear.map(Double.init), ascending: false)
        case .oldestFilm:
            return WatchlistOrder.compare(
                a.releaseYear.map(Double.init), b.releaseYear.map(Double.init), ascending: true)
        case .shortest:
            return WatchlistOrder.compare(
                a.runtimeMinutes.map(Double.init), b.runtimeMinutes.map(Double.init),
                ascending: true)
        case .longest:
            return WatchlistOrder.compare(
                a.runtimeMinutes.map(Double.init), b.runtimeMinutes.map(Double.init),
                ascending: false)
        case .alphabetical:
            return a.title.localizedCaseInsensitiveCompare(b.title) == .orderedAscending
        case .bestMatch:
            // Ohne Wert nach hinten, wie bei jeder anderen fehlenden
            // Angabe auch. Ein Film ohne Übereinstimmung ist nicht der
            // schlechteste, er ist unbekannt.
            return WatchlistOrder.compare(
                matches[a.filmID].map(Double.init), matches[b.filmID].map(Double.init),
                ascending: false)
        case .byPriority:
            // Innerhalb einer Stufe bleibt das Zuletzt-Hinzugefuegte
            // oben. Sonst waere die Reihenfolge innerhalb von "Normal"
            // beliebig, und beliebig sieht kaputt aus.
            if a.priority == b.priority { return a.addedAt > b.addedAt }
            return a.priority.rank < b.priority.rank
        }
    }

    static func compare(_ a: Double?, _ b: Double?, ascending: Bool) -> Bool {
        switch (a, b) {
        case (nil, nil): return false
        case (nil, _): return false
        case (_, nil): return true
        case (let x?, let y?): return ascending ? x < y : x > y
        }
    }
}

extension LiveFilmEntryRepository {
    /// Die eigene Watchlist, in einer Anfrage.
    func watchlist() async -> [WatchlistEntry] {
        let rows: [WatchlistEntry]? = try? await backend.client
            .rpc("watchlist_for_me")
            .execute()
            .value
        return rows ?? []
    }

    func watchlistGroups() async -> [WatchlistGroup] {
        let rows: [WatchlistGroup]? = try? await backend.client
            .rpc("watchlist_groups_for_me")
            .execute()
            .value
        return rows ?? []
    }

    /// Die Prioritaet eines vorgemerkten Films setzen.
    ///
    /// Die Policy laesst nur die eigene Zeile zu, deshalb steht hier
    /// kein `user_id`-Vergleich: er waere eine zweite Fassung derselben
    /// Regel, und zwei Fassungen laufen irgendwann auseinander.
    func setPriority(_ priority: WatchlistPriority, for filmID: String) async -> SaveOutcome {
        do {
            try await backend.client
                .from("watchlist")
                .update(["priority": priority.rawValue])
                .eq("film_id", value: filmID)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func createWatchlistGroup(named name: String) async -> SaveOutcome {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .failed("Die Gruppe braucht einen Namen.") }
        guard trimmed.count <= 40 else { return .failed("Höchstens 40 Zeichen.") }

        guard let mine = backend.client.auth.currentUser?.id else {
            return .failed("Du bist nicht angemeldet.")
        }
        do {
            try await backend.client
                .from("watchlist_groups")
                .insert(["user_id": mine.uuidString, "name": trimmed])
                .execute()
            return .saved
        } catch {
            // Der eindeutige Index faengt denselben Namen ab, auch
            // anders geschrieben. Die Meldung sagt, was los ist, statt
            // den Datenbankfehler durchzureichen.
            let backendError = BackendError.from(error)
            if backendError.message.localizedCaseInsensitiveContains("duplicate") {
                return .failed("Diese Gruppe gibt es schon.")
            }
            return .failed(backendError.message)
        }
    }

    func deleteWatchlistGroup(_ groupID: UUID) async -> SaveOutcome {
        do {
            try await backend.client
                .from("watchlist_groups")
                .delete()
                .eq("id", value: groupID.uuidString)
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }

    func setGroup(_ groupID: UUID, for filmID: String, on: Bool) async -> SaveOutcome {
        guard let mine = backend.client.auth.currentUser?.id else {
            return .failed("Du bist nicht angemeldet.")
        }
        do {
            if on {
                try await backend.client
                    .from("watchlist_group_films")
                    .insert([
                        "group_id": groupID.uuidString,
                        "user_id": mine.uuidString,
                        "film_id": filmID,
                    ])
                    .execute()
            } else {
                try await backend.client
                    .from("watchlist_group_films")
                    .delete()
                    .eq("group_id", value: groupID.uuidString)
                    .eq("film_id", value: filmID)
                    .execute()
            }
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}
