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
    var hasSpoilers = false
    var watchedOn = Date()
    var hasWatchedOn = false
    var visibility: EntryVisibility = .publicly

    private(set) var isOnWatchlist = false
    private(set) var isSaving = false
    private(set) var note: String?
    private(set) var savedAt: Date?

    /// Ob es schon einen Eintrag gab, als die Seite aufging.
    private(set) var hadEntry = false

    // --- Erweiterte Bewertung ------------------------------------------

    /// Die eigenen Facetten. Freiwillig, jede einzeln (ADR-009).
    var facets: [FacetKind: Int] = [:]
    private(set) var facetAverages: [FacetAverage] = []

    // --- Was die anderen schreiben --------------------------------------

    private(set) var reviews: [FilmReview] = []

    // --- Diskussion ------------------------------------------------------

    private(set) var thread = ThreadState.none
    private(set) var threshold = 5
    private(set) var messages: [ThreadMessage] = []
    private(set) var isPosting = false
    private(set) var discussionNote: String?
    var draft = ""
    var replyingTo: ThreadMessage?

    /// Der eigene Eintrag ist der Schlüssel zur Diskussion.
    ///
    /// **Angezeigt wird trotzdem nur, was Postgres herausgibt.** Diese
    /// Kennzeichnung entscheidet über die Erklärung im leeren Fall, nie
    /// über den Zugriff (ADR-010).
    var hasRated: Bool { rating > 0 && hadEntry }

    private let details: FilmDetailRepository
    /// Nicht privat: die Empfehlungsliste braucht dasselbe Repository,
    /// und ein zweites durchzureichen wäre eine zweite Verdrahtung
    /// derselben Sache.
    let entries: FilmEntryRepository

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
        async let averages = entries.facetAverages(for: film.wikidataID)
        async let mine = entries.ownFacets(for: film.wikidataID)
        async let written = entries.reviews(for: film.wikidataID, limit: 10)
        async let room = entries.thread(for: film.wikidataID)
        async let limit = entries.discussionThreshold()

        self.detail = await detail
        self.artwork = await artwork
        self.summary = await summary
        self.isOnWatchlist = await watchlist
        self.facetAverages = await averages
        self.facets = await mine
        self.reviews = await written
        self.thread = await room
        self.threshold = await limit

        if let entry = await own {
            hadEntry = true
            rating = entry.rating ?? 0
            review = entry.review ?? ""
            hasSpoilers = entry.hasSpoilers
            visibility = entry.visibility
            if let day = entry.watchedOn,
                let date = LiveFilmEntryRepository.dayFormatter.date(from: day)
            {
                watchedOn = date
                hasWatchedOn = true
            }
        }

        isLoading = false

        // Die Beiträge zuletzt und nur, wenn der Raum offen ist. Sonst
        // wäre es eine Anfrage, die verlässlich nichts zurückgibt.
        if thread.isActive { messages = await entries.messages(for: film.wikidataID) }
    }

    /// Einen Beitrag schreiben.
    func send() async {
        discussionNote = nil
        isPosting = true
        defer { isPosting = false }

        switch await entries.post(
            filmID: film.wikidataID, body: draft, replyingTo: replyingTo?.id)
        {
        case .saved:
            draft = ""
            replyingTo = nil
            messages = await entries.messages(for: film.wikidataID)
            thread = await entries.thread(for: film.wikidataID)
        case .failed(let message):
            discussionNote = message
        }
    }

    /// Die Beiträge nach Elternbeitrag geordnet.
    func replies(to parent: UUID) -> [ThreadMessage] {
        messages.filter { $0.parentID == parent }
    }

    var topLevel: [ThreadMessage] {
        messages.filter { $0.parentID == nil }
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
            hasSpoilers: hasSpoilers,
            visibility: visibility
        ) {
        case .saved(let entryID):
            hadEntry = true
            savedAt = Date()
            // Die Facetten hängen an der Zeile, nicht am Film. Erst nach
            // dem Speichern gibt es sie.
            await entries.replaceFacets(entryID: entryID, with: facets)
            facetAverages = await entries.facetAverages(for: film.wikidataID)
            reviews = await entries.reviews(for: film.wikidataID, limit: 10)
            thread = await entries.thread(for: film.wikidataID)
            // Mit der ersten eigenen Bewertung geht das Gate auf.
            if thread.isActive { messages = await entries.messages(for: film.wikidataID) }
            // Die eigene Bewertung zählt in den Durchschnitt hinein —
            // also neu holen statt selbst rechnen.
            summary = await entries.summary(for: film.wikidataID)
        case .failed(let message):
            note = message
        }
    }
}
