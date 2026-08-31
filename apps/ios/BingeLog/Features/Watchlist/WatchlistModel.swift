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
    private(set) var isLoading = true
    private(set) var note: String?

    var term = ""
    var order: WatchlistOrder = .newestAdded
    var genre: FilmGenre?
    /// Höchstlaufzeit in Minuten, oder `nil` für alle.
    var maximumRuntime: Int?
    var onlyRecommended = false

    /// Der Film, den „Überrasch mich" gezogen hat.
    var surprise: WatchlistEntry?

    private let entries: FilmEntryRepository

    init(entries: FilmEntryRepository) {
        self.entries = entries
    }

    func load() async {
        all = await entries.watchlist()
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
            maximumRuntime: maximumRuntime, onlyRecommended: onlyRecommended
        )
        .sorted(by: order.sorts)
    }

    var hasFilters: Bool {
        genre != nil || maximumRuntime != nil || onlyRecommended
    }

    func clearFilters() {
        genre = nil
        maximumRuntime = nil
        onlyRecommended = false
    }

    /// Die Auswahl als eigene Funktion, damit sie prüfbar ist.
    ///
    /// Ein Film **ohne** Laufzeitangabe fällt bei gesetztem
    /// Laufzeitfilter heraus. Unbekannt ist nicht kurz — dieselbe Regel
    /// wie beim Jahr in der Suche.
    nonisolated static func select(
        from entries: [WatchlistEntry], term: String, genre: String?,
        maximumRuntime: Int?, onlyRecommended: Bool
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
            return true
        }
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

    func remove(_ entry: WatchlistEntry) async {
        all.removeAll { $0.filmID == entry.filmID }
        _ = await entries.setWatchlist(entry.filmID, on: false)
    }

    /// Als gesehen eintragen — mit Bewertung, wie überall sonst.
    ///
    /// Und danach von der Watchlist herunter: sie sagt, was man **noch
    /// nicht** gesehen hat (Konzept).
    func markSeen(_ entry: WatchlistEntry, rating: Int) async {
        switch await entries.save(
            filmID: entry.filmID, rating: rating, watchedOn: Date(), review: nil,
            visibility: .publicly)
        {
        case .saved:
            all.removeAll { $0.filmID == entry.filmID }
            _ = await entries.setWatchlist(entry.filmID, on: false)
        case .failed(let message):
            note = message
        }
    }
}
