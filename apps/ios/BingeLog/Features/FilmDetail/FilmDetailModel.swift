import Foundation
import SwiftUI

/// Alles, was die Filmseite zeigt und ändert.
@Observable
@MainActor
final class FilmDetailModel {
    let film: Film

    private(set) var detail: FilmDetail?
    private(set) var artwork: PosterArtwork?
    private(set) var summary = RatingSummary(average: nil, votes: 0)
    private(set) var isLoading = true

    /// Der eigene Eintrag, aufgeteilt in das, was das Formular hält.
    var rating = 0
    var review = ""
    var watchedOn = Date()
    var hasWatchedOn = false
    var visibility: EntryVisibility = .publicly

    private(set) var isOnWatchlist = false
    private(set) var isSaving = false
    private(set) var note: String?
    private(set) var savedAt: Date?

    /// Ob es schon einen Eintrag gab, als die Seite aufging.
    private(set) var hadEntry = false

    private let details: FilmDetailRepository
    private let entries: FilmEntryRepository

    init(film: Film, details: FilmDetailRepository, entries: FilmEntryRepository) {
        self.film = film
        self.details = details
        self.entries = entries
    }

    /// Alles nebeneinander holen. Keins wartet auf ein anderes.
    func load() async {
        async let detail = details.detail(for: film.wikidataID)
        async let artwork = PosterLoader.load(for: film)
        async let summary = entries.summary(for: film.wikidataID)
        async let own = entries.ownEntry(for: film.wikidataID)
        async let watchlist = entries.isOnWatchlist(film.wikidataID)

        self.detail = await detail
        self.artwork = await artwork
        self.summary = await summary
        self.isOnWatchlist = await watchlist

        if let entry = await own {
            hadEntry = true
            rating = entry.rating ?? 0
            review = entry.review ?? ""
            visibility = entry.visibility
            if let day = entry.watchedOn,
                let date = LiveFilmEntryRepository.dayFormatter.date(from: day)
            {
                watchedOn = date
                hasWatchedOn = true
            }
        }

        isLoading = false
    }

    /// Sofort umlegen, dann sagen lassen, ob es geklappt hat.
    ///
    /// Ein Lesezeichen, das erst nach der Antwort umspringt, fühlt sich
    /// kaputt an; eins, das umspringt und beim nächsten Öffnen wieder
    /// aus ist, ist es.
    func toggleWatchlist() async {
        let wanted = !isOnWatchlist
        isOnWatchlist = wanted
        isOnWatchlist = await entries.setWatchlist(film.wikidataID, on: wanted)
    }

    func save() async {
        note = nil
        isSaving = true
        defer { isSaving = false }

        switch await entries.save(
            filmID: film.wikidataID,
            rating: rating,
            watchedOn: hasWatchedOn ? watchedOn : nil,
            review: review,
            visibility: visibility
        ) {
        case .saved:
            hadEntry = true
            savedAt = Date()
            // Die eigene Bewertung zählt in den Durchschnitt hinein —
            // also neu holen statt selbst rechnen.
            summary = await entries.summary(for: film.wikidataID)
        case .failed(let message):
            note = message
        }
    }
}
