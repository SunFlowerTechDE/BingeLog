import Foundation
import SwiftUI

/// Ein Monat im Tagebuch.
struct DiaryMonth: Identifiable, Sendable {
    let id: String
    let title: String
    let entries: [DiaryEntry]
}

/// Das Tagebuch und was der Nutzer daran einstellt.
@Observable
@MainActor
final class DiaryModel {
    private(set) var all: [DiaryEntry] = []
    private(set) var summary = DiarySummary.none
    private(set) var isLoading = true
    private(set) var note: String?

    var term = ""
    var order: DiaryOrder = .newest
    var genre: FilmGenre?
    var visibility: EntryVisibility?
    var onlyWithReview = false
    var onlyRewatches = false

    private let entries: FilmEntryRepository

    init(entries: FilmEntryRepository) {
        self.entries = entries
    }

    func load() async {
        async let rows = entries.diary()
        async let numbers = entries.diarySummary()
        all = await rows
        summary = await numbers
        isLoading = false
    }

    /// Die Kategorien, die im Tagebuch wirklich vorkommen.
    var availableGenres: [FilmGenre] {
        var seen: [String: FilmGenre] = [:]
        for entry in all {
            for genre in entry.genres where seen[genre.id] == nil { seen[genre.id] = genre }
        }
        return seen.values.sorted { $0.shortLabel < $1.shortLabel }
    }

    var hasFilters: Bool {
        genre != nil || visibility != nil || onlyWithReview || onlyRewatches
    }

    func clearFilters() {
        genre = nil
        visibility = nil
        onlyWithReview = false
        onlyRewatches = false
    }

    var shown: [DiaryEntry] {
        DiaryModel.select(
            from: all, term: term, genre: genre?.id, visibility: visibility,
            onlyWithReview: onlyWithReview, onlyRewatches: onlyRewatches
        )
        .sorted(by: order.sorts)
    }

    /// Nach Monat gruppiert, in der Reihenfolge, die die Sortierung
    /// vorgibt.
    ///
    /// Nur bei den beiden Datumssortierungen: nach Bewertung gruppiert
    /// ergäbe Monatsüberschriften, die keinen Zusammenhang mehr haben.
    var months: [DiaryMonth] {
        guard order == .newest || order == .oldest else {
            return [DiaryMonth(id: "alle", title: "", entries: shown)]
        }

        var out: [DiaryMonth] = []
        for entry in shown {
            let key = DiaryModel.monthKey(for: entry.effectiveDate)
            if out.last?.id == key {
                out[out.count - 1] = DiaryMonth(
                    id: key, title: out[out.count - 1].title,
                    entries: out[out.count - 1].entries + [entry])
            } else {
                out.append(
                    DiaryMonth(
                        id: key, title: DiaryModel.monthTitle(for: entry.effectiveDate),
                        entries: [entry]))
            }
        }
        return out
    }

    // ----------------------------------------------------------------

    /// Die Auswahl als eigene Funktion, damit sie prüfbar ist.
    nonisolated static func select(
        from entries: [DiaryEntry], term: String, genre: String?,
        visibility: EntryVisibility?, onlyWithReview: Bool, onlyRewatches: Bool
    ) -> [DiaryEntry] {
        let needle = term.trimmingCharacters(in: .whitespacesAndNewlines)

        return entries.filter { entry in
            if !needle.isEmpty,
                !entry.title.localizedCaseInsensitiveContains(needle),
                !entry.titleOriginal.localizedCaseInsensitiveContains(needle),
                // Auch in der eigenen Rezension suchen: „was habe ich
                // damals über den Schluss geschrieben" ist eine echte
                // Frage an ein Tagebuch.
                !(entry.review ?? "").localizedCaseInsensitiveContains(needle)
            {
                return false
            }
            if let genre, !entry.genreIDs.contains(genre) { return false }
            if let visibility, entry.visibility != visibility { return false }
            if onlyWithReview, (entry.review ?? "").isEmpty { return false }
            if onlyRewatches, !entry.isRewatch { return false }
            return true
        }
    }

    nonisolated static func monthKey(for date: Date?) -> String {
        guard let date else { return "ohne" }
        let parts = Calendar.current.dateComponents([.year, .month], from: date)
        return "\(parts.year ?? 0)-\(parts.month ?? 0)"
    }

    nonisolated static func monthTitle(for date: Date?) -> String {
        guard let date else { return "Ohne Datum" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "LLLL yyyy"
        return formatter.string(from: date)
    }

    // ----------------------------------------------------------------

    func save(
        _ entry: DiaryEntry, rating: Int, watchedOn: Date?, review: String,
        visibility: EntryVisibility
    ) async {
        note = nil
        switch await entries.updateEntry(
            id: entry.id, rating: rating, watchedOn: watchedOn, review: review,
            visibility: visibility)
        {
        case .saved: await load()
        case .failed(let message): note = message
        }
    }

    func delete(_ entry: DiaryEntry) async {
        note = nil
        // Sofort aus der Liste nehmen: eine Zeile, die erst nach der
        // Antwort verschwindet, fühlt sich kaputt an.
        all.removeAll { $0.id == entry.id }
        switch await entries.deleteEntry(id: entry.id) {
        case .saved: summary = await entries.diarySummary()
        case .failed(let message):
            note = message
            await load()
        }
    }
}
