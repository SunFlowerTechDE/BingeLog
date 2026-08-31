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

    /// Was draußen gefunden wurde, bevor etwas geschrieben ist.
    private(set) var candidates: [FilmCandidate] = []
    /// Der Treffer, dessen Prüfkarte gerade offen ist.
    var inspecting: FilmCandidate?
    /// Ob es sich lohnt, das Jahr wegzulassen (Suchkonzept, 3).
    private(set) var offersDroppingTheYear = false

    /// Zuletzt gesucht, lokal.
    private(set) var history: [String] = SearchHistory.load()

    /// Filme, die der Nutzer schon eingetragen hat beziehungsweise
    /// vorgemerkt hat — für die kleinen Kennzeichnungen in der
    /// Trefferliste (Suchkonzept, 28).
    private(set) var seen: Set<String> = []
    private(set) var onWatchlist: Set<String> = []

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
    private let entries: FilmEntryRepository
    private var task: Task<Void, Never>?

    init(
        repository: FilmRepository, lazyFilms: LazyFilmRepository,
        entries: FilmEntryRepository
    ) {
        self.repository = repository
        self.lazyFilms = lazyFilms
        self.entries = entries
    }

    /// Einen Knopf und keine selbsttätige Abfrage.
    ///
    /// Sonst würde jeder Tippfehler eine Anfrage nach draußen, und ein
    /// vertippter Titel trifft trotzdem manchmal etwas. Einen fremden
    /// Film in den Katalog zu schreiben, weil jemand verrutscht ist,
    /// wäre schlimmer als ein Tippen mehr auf einem Weg, der ohnehin
    /// selten ist.
    ///
    /// **Nachsehen, nicht anlegen.** Was gefunden wurde, geht erst in
    /// die Prüfkarte (Suchkonzept, 8).
    func lookOutside() async {
        note = nil
        candidates = []
        isCreating = true
        defer { isCreating = false }

        switch await lazyFilms.look(term: term, year: year) {
        case .failure(let problem):
            note = problem.message
            offersDroppingTheYear = problem.suggestsDroppingTheYear && year != nil
        case .success(let found):
            offersDroppingTheYear = false
            // Genau einer: dann gibt es nichts auszuwählen, und die
            // Prüfkarte steht sofort. Mehrere heißt „Halloween", und da
            // entscheidet der Nutzer (Suchkonzept, 14).
            candidates = found
            if found.count == 1 { inspecting = found.first }
        }
    }

    /// Den ausgesuchten Film aufnehmen.
    func adopt(_ candidate: FilmCandidate) async {
        note = nil
        isCreating = true
        defer { isCreating = false }

        switch await lazyFilms.adopt(candidate) {
        case .failure(let problem):
            note = problem.message
        case .success(let film):
            candidates = []
            inspecting = nil
            // Das Plakat **vor** dem ersten Takt holen: die Karte soll
            // stehen, wenn sie sich zusammensetzt, und nicht mittendrin
            // erscheinen.
            buildArtwork = await PosterLoader.load(for: film.film)
            building = film
        }
    }

    func use(_ term: String) {
        self.term = term
    }

    func forget(_ term: String) {
        SearchHistory.forget(term)
        history = SearchHistory.load()
    }

    func clearHistory() {
        SearchHistory.clear()
        history = []
    }

    /// Was der Nutzer von diesen Filmen schon kennt.
    ///
    /// Zwei kleine Abfragen statt einer je Zeile. Ohne Anmeldung
    /// passiert nichts — dann gibt es weder Tagebuch noch Watchlist.
    private func markStatuses(for films: [Film]) async {
        let ids = films.map(\.wikidataID)
        guard !ids.isEmpty else {
            seen = []
            onWatchlist = []
            return
        }
        let status = await entries.statuses(for: ids)
        guard !Task.isCancelled else { return }
        seen = status.seen
        onWatchlist = status.onWatchlist
    }

    /// Das Jahr fallen lassen und noch einmal nachsehen.
    func retryWithoutYear() async {
        yearText = ""
        offersDroppingTheYear = false
        await lookOutside()
    }

    /// Die Zeremonie ist vorbei. Der Katalog hat sich unter der
    /// Trefferliste geändert, die dahinter noch steht.
    func finishBuilding() {
        building = nil
        buildArtwork = nil
        candidates = []
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

                // Gemerkt wird erst, wenn wirklich etwas gefunden
                // wurde. Ein Verlauf voller Tippfehler hilft niemandem.
                if !result.isEmpty {
                    SearchHistory.remember(current)
                    history = SearchHistory.load()
                }

                await markStatuses(for: result)
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
