import SwiftUI
import UniformTypeIdentifiers

/// Die eigene Filmhistorie übernehmen (M5).
///
/// Der Nutzer sieht: Datei wählen, wird gelesen, Vorschau, Import
/// starten, Fortschritt, Ergebnis. **Nicht** CSV-Dateien,
/// Datenbank-Bezeichner oder woher fehlende Filme kommen.
struct ImportView: View {
    @Environment(Repositories.self) private var repos

    @State private var phase: Phase = .start
    @State private var isPicking = false
    @State private var note: String?

    private enum Phase: Equatable {
        case start
        case reading
        case preview(UUID, ImportPreview)
        case running(UUID, ImportStep)
        case done(ImportStep)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                switch phase {
                case .start: intro
                case .reading: reading
                case .preview(let id, let preview): previewCard(id, preview)
                case .running(_, let step): progress(step)
                case .done(let step): result(step)
                }

                if let note {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.red)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
        }
        .background(Theme.background)
        .navigationTitle("Daten importieren")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $isPicking,
            allowedContentTypes: [.zip],
            allowsMultipleSelection: false
        ) { result in
            Task { await pick(result) }
        }
    }

    // ----------------------------------------------------------------

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Von Letterboxd importieren")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            Text(
                "Lade deinen Letterboxd-Datenexport hoch und übernimm deine bisherige "
                    + "Filmhistorie — Bewertungen, Tagebuch, Rezensionen und Watchlist."
            )
            .font(.callout)
            .foregroundStyle(Theme.muted)

            // Woher der Export kommt, muss dastehen: sonst weiss der
            // Nutzer nicht, welche Datei gemeint ist.
            Text(
                "Den Export bekommst du bei Letterboxd unter Einstellungen, Daten, "
                    + "Export. Lade die ZIP-Datei hoch, so wie du sie bekommen hast."
            )
            .font(.footnote)
            .foregroundStyle(Theme.quiet)

            Button {
                note = nil
                isPicking = true
            } label: {
                Text("Datei auswählen")
                    .font(.headline)
                    .foregroundStyle(Theme.onPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.primary, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)

            Text(
                "Die Datei wird nur gelesen und danach gelöscht. "
                    + "Bis du bestätigst, ändert sich an deinem Konto nichts."
            )
            .font(.caption2)
            .foregroundStyle(Theme.quiet)
        }
    }

    private var reading: some View {
        VStack(alignment: .leading, spacing: 12) {
            ProgressView()
            Text("Deine Daten werden gelesen.")
                .font(.callout)
                .foregroundStyle(Theme.foreground)
            Text("Noch wird nichts übernommen.")
                .font(.caption)
                .foregroundStyle(Theme.quiet)
        }
    }

    private func previewCard(_ id: UUID, _ preview: ImportPreview) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Das haben wir gefunden")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            VStack(spacing: 0) {
                line("Einträge insgesamt", preview.total)
                line("Bewertungen", preview.ratings)
                line("Tagebucheinträge", preview.diary)
                line("Rezensionen", preview.reviews)
                line("Watchlist", preview.watchlist)
                line("Filme schon im Katalog", preview.filmsKnown)
                line("Filme, die neu aufgenommen werden", preview.filmsNew)
                if preview.needsReview > 0 {
                    line("Filme, die wir nicht sicher zuordnen können", preview.needsReview)
                }
            }
            .padding(12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }

            if preview.filmsNew > 0 {
                Text(
                    "\(preview.filmsNew) Filme fehlen noch im Katalog. Sie werden während "
                        + "des Imports hinzugefügt — danach stehen sie für alle bereit."
                )
                .font(.caption)
                .foregroundStyle(Theme.muted)
            }

            Text("Was du hier schon eingetragen hast, bleibt. Ergänzt wird nur, was fehlt.")
                .font(.caption)
                .foregroundStyle(Theme.quiet)

            Button {
                Task { await start(id) }
            } label: {
                Text("Import starten")
                    .font(.headline)
                    .foregroundStyle(Theme.onPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Theme.primary, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)

            Button("Abbrechen") {
                Task {
                    await repos.imports.cancel(id)
                    phase = .start
                }
            }
            .font(.footnote)
            .foregroundStyle(Theme.quiet)
        }
    }

    private func progress(_ step: ImportStep) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Import läuft")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            ProgressView(
                value: Double(step.imported),
                total: Double(max(1, step.imported + step.remaining))
            )
            .tint(Theme.primary)

            Text("\(step.imported) von \(step.imported + step.remaining)")
                .font(.callout)
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()

            Text(
                "Das kann bei vielen Filmen ein paar Minuten dauern. "
                    + "Du kannst die App dabei liegen lassen."
            )
            .font(.caption)
            .foregroundStyle(Theme.quiet)
        }
    }

    private func result(_ step: ImportStep) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Import abgeschlossen")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            VStack(spacing: 0) {
                line("Übernommen", step.imported)
                if step.needsReview > 0 { line("Brauchen deine Hilfe", step.needsReview) }
                if step.failed > 0 { line("Nicht zugeordnet", step.failed) }
            }
            .padding(12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }

            if step.failed > 0 || step.needsReview > 0 {
                Text(
                    "Einzelne Filme konnten wir nicht sicher zuordnen. Der Rest ist da — "
                        + "du kannst sie später von Hand nachtragen."
                )
                .font(.caption)
                .foregroundStyle(Theme.muted)
            }

            Button("Fertig") { phase = .start }
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.primary)
        }
    }

    private func line(_ label: String, _ value: Int) -> some View {
        HStack {
            Text(label)
                .font(.footnote)
                .foregroundStyle(Theme.muted)
            Spacer()
            Text("\(value)")
                .font(.footnote.weight(.medium))
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()
        }
        .padding(.vertical, 5)
    }

    // ----------------------------------------------------------------

    private func pick(_ result: Result<[URL], Error>) async {
        guard case .success(let urls) = result, let url = urls.first else { return }
        note = nil
        phase = .reading

        // Die Datei liegt ausserhalb der App-Sandbox; ohne diesen Zugang
        // ist sie nicht lesbar.
        guard url.startAccessingSecurityScopedResource() else {
            note = "Auf die Datei können wir nicht zugreifen."
            phase = .start
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }

        guard let data = try? Data(contentsOf: url) else {
            note = "Die Datei ließ sich nicht lesen."
            phase = .start
            return
        }

        switch await repos.imports.analyse(zip: data) {
        case .success(let (id, preview)):
            phase = .preview(id, preview)
        case .failure(let problem):
            note = problem.message
            phase = .start
        }
    }

    /// Scheibe für Scheibe, bis nichts mehr offen ist.
    ///
    /// Der Server merkt sich den Stand; bricht die Verbindung ab, geht
    /// es beim nächsten Aufruf weiter statt von vorn.
    private func start(_ id: UUID) async {
        note = nil
        phase = .running(id, ImportStep(done: false, remaining: 0, imported: 0, failed: 0, needsReview: 0))

        while true {
            switch await repos.imports.step(batch: id) {
            case .failure(let problem):
                note = problem.message
                return
            case .success(let step):
                if step.done {
                    phase = .done(step)
                    return
                }
                phase = .running(id, step)
            }
        }
    }
}
