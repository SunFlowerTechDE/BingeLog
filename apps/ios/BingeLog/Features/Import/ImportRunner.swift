import Foundation
import SwiftUI

/// Der laufende Import — **über der Ansicht**, nicht in ihr.
///
/// Er lebt so lange wie die App und nicht so lange wie ein Bildschirm.
/// Wer den Import anstößt, soll weiterstöbern können, ohne dass er
/// abbricht; bei tausend Filmen will niemand eine halbe Stunde auf
/// einen Balken schauen.
///
/// **Angetrieben wird er ohnehin vom Server**: die Edge Function ruft
/// sich für die nächste Scheibe selbst. Dieses Objekt stößt einmal an
/// und fragt danach nur noch, wie weit es ist — es könnte auch
/// abgeschaltet werden, ohne dass der Import stehenbliebe.
@Observable
@MainActor
final class ImportRunner {
    /// Der Stapel, der gerade läuft. `nil` heißt: keiner.
    private(set) var batch: UUID?
    private(set) var processed = 0
    private(set) var total = 0
    private(set) var finished: ImportStep?
    private(set) var note: String?

    var isRunning: Bool { batch != nil }

    var progress: Double {
        guard total > 0 else { return 0 }
        return min(1, Double(processed) / Double(total))
    }

    private let repository: ImportRepository
    private var watcher: Task<Void, Never>?

    init(repository: ImportRepository) {
        self.repository = repository
    }

    func start(_ id: UUID, total: Int) {
        batch = id
        self.total = total
        processed = 0
        finished = nil
        note = nil

        watcher?.cancel()
        watcher = Task { await drive(id) }
    }

    /// Einmal anstoßen, dann zusehen.
    ///
    /// Der erste Aufruf setzt die Kette in Gang; danach genügt es, den
    /// Stand zu lesen. Bricht die Kette auf dem Server ab, stößt dieses
    /// Objekt sie wieder an — der Stand steht in der Datenbank, es geht
    /// weiter, wo es stehengeblieben ist.
    private func drive(_ id: UUID) async {
        if case .failure(let problem) = await repository.step(batch: id) {
            note = problem.message
            batch = nil
            return
        }

        var stillCount = 0
        var lastSeen = -1

        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(800))
            guard !Task.isCancelled else { return }
            guard let state = await repository.batch(id) else { continue }

            processed = state.processedItems
            if state.totalItems > 0 { total = state.totalItems }

            if state.status == .completed || state.status == .completedWithErrors {
                finished = ImportStep(
                    done: true, remaining: 0, imported: state.successfulItems,
                    failed: state.failedItems, needsReview: 0)
                batch = nil
                return
            }

            if state.status == .failed {
                note = "Der Import ist steckengeblieben. Starte ihn noch einmal."
                batch = nil
                return
            }

            // Zehn Runden ohne Fortschritt heißen: die Kette auf dem
            // Server ist gerissen. Dann wird sie neu angestoßen — das
            // ist billiger als ein Import, der stumm liegenbleibt.
            if state.processedItems == lastSeen {
                stillCount += 1
                if stillCount >= 10 {
                    stillCount = 0
                    _ = await repository.step(batch: id)
                }
            } else {
                stillCount = 0
                lastSeen = state.processedItems
            }
        }
    }

    /// Das Ergebnis quittieren.
    func acknowledge() {
        finished = nil
        note = nil
    }
}
