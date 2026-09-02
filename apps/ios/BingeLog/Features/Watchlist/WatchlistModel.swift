import Foundation
import SwiftUI

/// Die Watchlist und was der Nutzer daran einstellt.
///
/// **Gefiltert und sortiert wird hier**, nicht in der Datenbank. Eine
/// Watchlist hat Dutzende Einträge; sie einmal zu holen und dann ohne
/// Netz umzusortieren ist schneller als jede Runde zum Server.
@Observable
@MainActor
final class WatchlistModel {
    private(set) var all: [WatchlistEntry] = []
    private(set) var groups: [WatchlistGroup] = []
    private(set) var isLoading = true
    private(set) var note: String?

    var term = ""
    var order: WatchlistOrder = .newestAdded
    var genre: FilmGenre?
    /// Höchstlaufzeit in Minuten, oder `nil` für alle.
    var maximumRuntime: Int?
    var onlyRecommended = false
    var priority: WatchlistPriority?
    var group: WatchlistGroup?

    /// Der Film, den „Überrasch mich" gezogen hat.
    var surprise: WatchlistEntry?

    private let entries: FilmEntryRepository

    init(entries: FilmEntryRepository) {
        self.entries = entries
    }

    func load() async {
        all = await entries.watchlist()
        groups = await entries.watchlistGroups()

        // Eine geloeschte Gruppe darf nicht als Filter stehen bleiben,
        // sonst zeigt die Liste dauerhaft nichts und niemand sieht,
        // warum.
        if let group, !groups.contains(where: { $0.id == group.id }) { self.group = nil }
        isLoading = false
    }

    /// Die Genres, die in dieser Watchlist wirklich vorkommen.
    ///
    /// Nicht alle vierzig aus dem Katalog: ein Filter, der auf nichts
    /// zeigt, ist kein Filter.
    var availableGenres: [FilmGenre] {
        var seen: [String: FilmGenre] = [:]
        for entry in all {
            for genre in entry.genres where seen[genre.id] == nil {
                seen[genre.id] = genre
            }
        }
        return seen.values.sorted { $0.shortLabel < $1.shortLabel }
    }

    /// Was nach Suche und Filtern übrig bleibt, in der gewählten Ordnung.
    var shown: [WatchlistEntry] {
        WatchlistModel.select(
            from: all, term: term, genre: genre?.id,
            maximumRuntime: maximumRuntime, onlyRecommended: onlyRecommended,
            priority: priority, group: group?.id
        )
        .sorted(by: order.sorts)
    }

    var hasFilters: Bool {
        genre != nil || maximumRuntime != nil || onlyRecommended || priority != nil
            || group != nil
    }

    func clearFilters() {
        genre = nil
        maximumRuntime = nil
        onlyRecommended = false
        priority = nil
        group = nil
    }

    /// Die Auswahl als eigene Funktion, damit sie prüfbar ist.
    ///
    /// Ein Film **ohne** Laufzeitangabe fällt bei gesetztem
    /// Laufzeitfilter heraus. Unbekannt ist nicht kurz — dieselbe Regel
    /// wie beim Jahr in der Suche.
    nonisolated static func select(
        from entries: [WatchlistEntry], term: String, genre: String?,
        maximumRuntime: Int?, onlyRecommended: Bool,
        priority: WatchlistPriority? = nil, group: UUID? = nil
    ) -> [WatchlistEntry] {
        let needle = term.trimmingCharacters(in: .whitespacesAndNewlines)

        return entries.filter { entry in
            if !needle.isEmpty,
                entry.title.localizedCaseInsensitiveContains(needle) == false,
                entry.titleOriginal.localizedCaseInsensitiveContains(needle) == false
            {
                return false
            }
            if let genre, !entry.genreIDs.contains(genre) { return false }
            if let maximumRuntime {
                guard let minutes = entry.runtimeMinutes, minutes <= maximumRuntime else {
                    return false
                }
            }
            if onlyRecommended, entry.recommenders == 0 { return false }
            if let priority, entry.priority != priority { return false }
            if let group, !entry.groupIDs.contains(group) { return false }
            return true
        }
    }

    /// Der Vorschlag für heute Abend (Watchlist-Konzept).
    ///
    /// **Nicht zufällig.** „Überrasch mich" würfelt, das hier wählt: aus
    /// dem, was zu Zeit und Genre passt, kommt der Film mit dem
    /// stärksten Argument. Ein Vorschlag, der genauso gut ein Los sein
    /// könnte, ist kein Vorschlag.
    ///
    /// Die Reihenfolge der Argumente: eine Empfehlung an mich wiegt
    /// schwerer als „Freunde haben ihn gesehen", und beides schwerer als
    /// ein guter Schnitt unter Fremden.
    nonisolated static func suggestion(
        from entries: [WatchlistEntry], maximumRuntime: Int?, genre: String?,
        socialOnly: Bool
    ) -> WatchlistEntry? {
        let passend = select(
            from: entries, term: "", genre: genre, maximumRuntime: maximumRuntime,
            onlyRecommended: false
        )
        .filter { !socialOnly || $0.recommenders > 0 || $0.friendsSeen > 0 }

        return passend.max { a, b in
            if a.socialWeight != b.socialWeight { return a.socialWeight < b.socialWeight }
            if a.average != b.average { return (a.average ?? 0) < (b.average ?? 0) }
            // Zuletzt die Prioritaet, damit zwei gleich starke Filme
            // nicht in beliebiger Reihenfolge herauskommen.
            return a.priority.rank > b.priority.rank
        }
    }

    /// Den Vorschlag ins selbe Blatt legen wie „Überrasch mich".
    func suggest(maximumRuntime: Int?, genre: String?, socialOnly: Bool) {
        surprise = WatchlistModel.suggestion(
            from: all, maximumRuntime: maximumRuntime, genre: genre, socialOnly: socialOnly)
    }

    /// Zieht einen Film aus dem, was gerade sichtbar ist.
    ///
    /// **Aus der gefilterten Auswahl**, nicht aus der ganzen Liste: wer
    /// „Horror unter 120 Minuten" eingestellt hat, will keinen
    /// Dreistünder vorgeschlagen bekommen (Konzept).
    func surpriseMe() {
        surprise = shown.randomElement()
    }

    // ----------------------------------------------------------------

    /// Die Prioritaet umstellen.
    ///
    /// Erst hier, dann beim Server: die Liste soll sich unter dem Finger
    /// bewegen. Geht es schief, wird zurueckgedreht — eine Stufe, die
    /// dasteht und nicht gespeichert ist, waere schlimmer als gar keine.
    func setPriority(_ level: WatchlistPriority, for entry: WatchlistEntry) async {
        let vorher = entry.priority
        apply(level, to: entry.filmID)

        if case .failed(let message) = await entries.setPriority(level, for: entry.filmID) {
            apply(vorher, to: entry.filmID)
            note = message
        }
    }

    private func apply(_ level: WatchlistPriority, to filmID: String) {
        guard let index = all.firstIndex(where: { $0.filmID == filmID }) else { return }
        all[index] = all[index].with(priority: level)
    }

    func createGroup(named name: String) async {
        switch await entries.createWatchlistGroup(named: name) {
        case .saved: groups = await entries.watchlistGroups()
        case .failed(let message): note = message
        }
    }

    func deleteGroup(_ group: WatchlistGroup) async {
        switch await entries.deleteWatchlistGroup(group.id) {
        case .saved:
            groups.removeAll { $0.id == group.id }
            if self.group?.id == group.id { self.group = nil }
            // Die Zuordnungen sind mit weg, also stimmt jede Karte, die
            // noch auf diese Gruppe zeigt, nicht mehr.
            all = all.map { $0.without(group: group.id) }
        case .failed(let message):
            note = message
        }
    }

    func setGroup(_ group: WatchlistGroup, for entry: WatchlistEntry, on: Bool) async {
        switch await entries.setGroup(group.id, for: entry.filmID, on: on) {
        case .saved:
            guard let index = all.firstIndex(where: { $0.filmID == entry.filmID }) else { return }
            all[index] = on
                ? all[index].with(group: group.id)
                : all[index].without(group: group.id)
            groups = await entries.watchlistGroups()
        case .failed(let message):
            note = message
        }
    }

    func remove(_ entry: WatchlistEntry) async {
        all.removeAll { $0.filmID == entry.filmID }
        _ = await entries.setWatchlist(entry.filmID, on: false)
        // Der Fremdschluessel raeumt die Gruppenzuordnung mit, also
        // stimmen die Anzahlen sonst nicht mehr.
        if !entry.groupIDs.isEmpty { groups = await entries.watchlistGroups() }
    }

    /// Als gesehen eintragen — mit Bewertung, wie überall sonst.
    ///
    /// Und danach von der Watchlist herunter: sie sagt, was man **noch
    /// nicht** gesehen hat (Konzept).
    func markSeen(_ entry: WatchlistEntry, rating: Int) async {
        switch await entries.save(
            filmID: entry.filmID, rating: rating, watchedOn: Date(), review: nil,
            hasSpoilers: false, visibility: .publicly)
        {
        case .saved:
            all.removeAll { $0.filmID == entry.filmID }
            _ = await entries.setWatchlist(entry.filmID, on: false)
            if !entry.groupIDs.isEmpty { groups = await entries.watchlistGroups() }
        case .failed(let message):
            note = message
        }
    }
}
