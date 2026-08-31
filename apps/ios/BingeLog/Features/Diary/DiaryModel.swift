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
    /// Mit oder ohne Bewertung, oder egal.
    var ratedState: RatedState = .any
    /// Das Jahr, oder `nil` für alle.
    var year: Int?

    enum RatedState: String, CaseIterable, Sendable {
        case any, rated, unrated
    }

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
            || ratedState != .any || year != nil
    }

    func clearFilters() {
        genre = nil
        visibility = nil
        onlyWithReview = false
        onlyRewatches = false
        ratedState = .any
        year = nil
    }

    /// Die Jahre, in denen wirklich etwas steht — jüngstes zuerst.
    ///
    /// Nicht alle Jahre seit 1900: eine Auswahl, die auf nichts zeigt,
    /// ist keine.
    var availableYears: [Int] {
        var seen: Set<Int> = []
        for entry in all {
            if let date = entry.effectiveDate {
                seen.insert(Calendar.current.component(.year, from: date))
            }
        }
        return seen.sorted(by: >)
    }

    /// Die Sichtungsnummer je Eintrag, über das ganze Tagebuch gerechnet
    /// — nicht über die gefilterte Auswahl. Sonst wäre „2. Sichtung"
    /// davon abhängig, welcher Filter gerade gesetzt ist.
    var viewingNumbers: [UUID: Int] { all.viewingNumbers() }

    var shown: [DiaryEntry] {
        DiaryModel.select(
            from: all, term: term, genre: genre?.id, visibility: visibility,
            onlyWithReview: onlyWithReview, onlyRewatches: onlyRewatches,
            ratedState: ratedState, year: year
        )
        .sorted(by: order.sorts)
    }

    /// Nach Monat gruppiert, in der Reihenfolge, die die Sortierung
    /// vorgibt.
    ///
    /// Nur bei den beiden Datumssortierungen: nach Bewertung gruppiert
    /// ergäbe Monatsüberschriften, die keinen Zusammenhang mehr haben.
    var months: [DiaryMonth] {
        guard order.groupsByMonth else {
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
        visibility: EntryVisibility?, onlyWithReview: Bool, onlyRewatches: Bool,
        ratedState: RatedState = .any, year: Int? = nil
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
            switch ratedState {
            case .any: break
            case .rated: if entry.rating == nil { return false }
            case .unrated: if entry.rating != nil { return false }
            }
            if let year {
                guard let date = entry.effectiveDate,
                    Calendar.current.component(.year, from: date) == year
                else { return false }
            }
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
        hasSpoilers: Bool, visibility: EntryVisibility
    ) async {
        note = nil
        switch await entries.updateEntry(
            id: entry.id, rating: rating, watchedOn: watchedOn, review: review,
            hasSpoilers: hasSpoilers, visibility: visibility)
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
