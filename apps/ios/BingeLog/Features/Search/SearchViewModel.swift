import Foundation
import Observation

/// Der Zustand der Suche.
@Observable
@MainActor
final class SearchViewModel {
    var term = "" {
        didSet { scheduleSearch() }
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

        task = Task {
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }

            isSearching = true
            defer { isSearching = false }

            do {
                let result = try await repository.search(term: current, limit: 20)
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
