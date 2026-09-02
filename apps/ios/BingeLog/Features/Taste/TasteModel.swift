import Foundation
import SwiftUI

/// Der Geschmackscheck: ein Stapel Karten, drei Knöpfe.
///
/// **Merken kommt vor der Stimme.** Ein Urteil schiebt die Karte weiter,
/// also gäbe es danach nichts mehr zu merken. Der Knopf sitzt deshalb
/// auf der Karte selbst und ist von der Stimme unabhängig — man darf
/// einen Film vormerken und ihn trotzdem nicht mögen.
@Observable
@MainActor
final class TasteModel {
    private(set) var cards: [TasteCard] = []
    private(set) var index = 0
    private(set) var readiness: TasteReadiness = .empty
    private(set) var isLoading = true
    private(set) var note: String?

    /// Welche Filme in diesem Durchgang vorgemerkt wurden.
    private(set) var saved: Set<String> = []
    /// Wie viele Karten in diesem Durchgang beantwortet sind.
    private(set) var answered = 0

    private let taste: TasteRepository
    private let entries: FilmEntryRepository

    /// Wie viele Karten auf einmal geholt werden. Zwanzig ist der
    /// Durchgang aus dem Entwurf; nachgeladen wird, bevor der Stapel
    /// leer ist.
    private let batch = 20

    init(taste: TasteRepository, entries: FilmEntryRepository) {
        self.taste = taste
        self.entries = entries
    }

    var current: TasteCard? {
        index < cards.count ? cards[index] : nil
    }

    /// Die Karte darunter, damit der Stapel nach Stapel aussieht.
    var next: TasteCard? {
        index + 1 < cards.count ? cards[index + 1] : nil
    }

    var isDone: Bool { !isLoading && current == nil }

    func load() async {
        isLoading = true
        cards = await taste.deck(count: batch)
        index = 0
        readiness = await taste.readiness()
        isLoading = false
    }

    /// Vormerken, ohne zu urteilen.
    func keep(_ card: TasteCard) async {
        guard !saved.contains(card.filmID) else { return }
        saved.insert(card.filmID)

        if await entries.setWatchlist(card.filmID, on: true) == false {
            saved.remove(card.filmID)
            note = "Das hat nicht geklappt."
        }
    }

    /// Urteilen und weiterblättern.
    ///
    /// Die Karte geht sofort weiter, das Speichern läuft daneben. Auf
    /// eine Antwort zu warten hiesse, bei zwanzig Karten zwanzigmal zu
    /// warten.
    func decide(_ verdict: TasteVerdict, on card: TasteCard) {
        index += 1
        answered += 1

        Task {
            if case .failed(let message) = await taste.vote(verdict, on: card.filmID) {
                note = message
            }
            // Die Belastbarkeit erst nachziehen, wenn sich etwas
            // Sichtbares getan hat. Nach jeder Karte zu fragen waere
            // zwanzig Anfragen fuer eine Zahl, die sich kaum bewegt.
            if answered % 5 == 0 { readiness = await taste.readiness() }

            // Nachladen, bevor der Stapel leer ist.
            if index >= cards.count - 3 { await extend() }
        }
    }

    private func extend() async {
        let weitere = await taste.deck(count: batch)
        let bekannt = Set(cards.map(\.filmID))
        cards.append(contentsOf: weitere.filter { !bekannt.contains($0.filmID) })
    }

    /// Am Ende eines Durchgangs die Zahl endgültig holen.
    func finish() async {
        readiness = await taste.readiness()
    }
}
