import Foundation
import Observation

/// Der Zustand der Suche.
@Observable
@MainActor
final class SearchViewModel {
    var term = "" {
        didSet { scheduleSearch() }
    }

    /// Das Jahr, vier Ziffern, freiwillig.
    ///
    /// Als Text und nicht als Zahl: getippt wird Zeichen für Zeichen,
    /// und „19" ist noch kein Jahr. Erst ``year`` macht daraus eine
    /// Angabe — oder eben keine.
    var yearText = "" {
        didSet {
            let gefiltert = SearchViewModel.onlyDigits(yearText)
            // Ohne diese Bedingung riefe die Zuweisung `didSet` erneut
            // auf, und zwar endlos.
            if gefiltert != yearText {
                yearText = gefiltert
                return
            }
            scheduleSearch()
        }
    }

    /// Vier Ziffern oder nichts.
    ///
    /// Bei drei Ziffern wird **nicht** eingegrenzt. Sonst suchte die App
    /// beim Tippen von „1999" kurz nach dem Jahr 199 und zeigte für
    /// einen Moment gar nichts — was aussieht, als gäbe es den Film
    /// nicht.
    var year: Int? {
        guard yearText.count == 4 else { return nil }
        return Int(yearText)
    }

    /// Ein angefangenes Jahr, das noch nicht greift.
    var yearIsIncomplete: Bool { !yearText.isEmpty && yearText.count < 4 }

    /// Nur Ziffern, höchstens vier.
    ///
    /// Als eigene Funktion, weil sich ein Textfeld nicht prüfen lässt,
    /// die Regel dahinter aber schon.
    nonisolated static func onlyDigits(_ text: String) -> String {
        String(text.filter(\.isNumber).prefix(4))
    }

    private(set) var films: [Film] = []
    private(set) var isSearching = false
    private(set) var problem: String?

    private let repository: FilmRepository
    private var task: Task<Void, Never>?

    init(repository: FilmRepository) {
        self.repository = repository
    }

    /// Gebremst und abbrechbar.
    ///
    /// Eine Anfrage je Tastendruck wäre eine zu viel, und eine langsame
    /// Antwort darf keine neuere überschreiben — deshalb wird die
    /// vorherige Aufgabe abgebrochen statt ihr Ergebnis später
    /// verworfen.
    private func scheduleSearch() {
        task?.cancel()
        let current = term
        let currentYear = year

        task = Task {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }

            isSearching = true
            defer { isSearching = false }

            do {
                let result = try await repository.search(
                    term: current, limit: 20, year: currentYear)
                guard !Task.isCancelled else { return }
                films = result
                problem = nil
            } catch {
                guard !Task.isCancelled else { return }
                films = []
                // Ueber ein Protokoll gerufen, verliert `throws(BackendError)`
                // seinen Typ: der Compiler sieht hier `any Error`. Also
                // einmal zurueckuebersetzen, statt die Typisierung
                // aufzugeben.
                problem = BackendError.from(error).message
            }
        }
    }
}
