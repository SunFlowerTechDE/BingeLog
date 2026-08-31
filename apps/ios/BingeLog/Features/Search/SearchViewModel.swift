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

    /// Der Film, der gerade angelegt wird, und was danebensteht.
    private(set) var building: CreatedFilm?
    private(set) var buildArtwork: PosterArtwork?
    private(set) var isCreating = false
    private(set) var note: String?

    /// Angeboten wird das Anlegen nur, wenn wirklich nichts da ist.
    ///
    /// Ein Knopf, der neben Treffern steht, lädt dazu ein, den Katalog
    /// mit Dubletten zu füllen.
    var canCreate: Bool {
        term.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
            && films.isEmpty && !isSearching && !isCreating
    }

    private let repository: FilmRepository
    private let lazyFilms: LazyFilmRepository
    private var task: Task<Void, Never>?

    init(repository: FilmRepository, lazyFilms: LazyFilmRepository) {
        self.repository = repository
        self.lazyFilms = lazyFilms
    }

    /// Einen Knopf und keine selbsttätige Abfrage.
    ///
    /// Sonst würde jeder Tippfehler eine Anfrage an Wikidata — einen
    /// gestifteten Dienst —, und ein vertippter Titel trifft trotzdem
    /// manchmal etwas. Einen fremden Film in den Katalog zu schreiben,
    /// weil jemand verrutscht ist, wäre schlimmer als ein Tippen mehr
    /// auf einem Weg, der ohnehin selten ist.
    func createMissingFilm() async {
        note = nil
        isCreating = true
        defer { isCreating = false }

        switch await lazyFilms.create(term: term, year: year) {
        case .failure(let problem):
            note = problem.message
        case .success(let created):
            // Nur der erste entsteht vor den Augen; die übrigen stehen
            // in der Liste, sobald die Zeremonie vorbei ist.
            guard let first = created.first else {
                note = LazyFilmProblem.notFound.message
                return
            }
            // Das Plakat **vor** dem ersten Takt holen: die Karte soll
            // stehen, wenn sie sich zusammensetzt, und nicht mittendrin
            // erscheinen.
            buildArtwork = await PosterLoader.load(for: first.film)
            building = first
        }
    }

    /// Die Zeremonie ist vorbei. Der Katalog hat sich unter der
    /// Trefferliste geändert, die dahinter noch steht.
    func finishBuilding() {
        building = nil
        buildArtwork = nil
        scheduleSearch()
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
