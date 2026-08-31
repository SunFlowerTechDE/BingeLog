import Foundation
import Supabase
import SwiftUI

/// Warum gemeldet wird.
///
/// Dieselben Werte wie `report_reason` in der Datenbank. Ein Tippfehler
/// hier ergäbe keinen Übersetzungsfehler, sondern eine abgewiesene
/// Meldung zur Laufzeit — und eine Meldung, die nicht ankommt, ist
/// schlimmer als keine.
nonisolated enum ReportReason: String, CaseIterable, Identifiable, Sendable {
    case spoiler
    case harassment
    case hate
    case sexual
    case violence
    case spam
    case illegal
    case other

    var id: String { rawValue }

    var label: String {
        switch self {
        case .spoiler: return "Unmarkierter Spoiler"
        case .harassment: return "Beleidigung oder Belästigung"
        case .hate: return "Hass und Hetze"
        case .sexual: return "Sexueller Inhalt"
        case .violence: return "Gewaltdarstellung"
        case .spam: return "Spam oder Werbung"
        case .illegal: return "Sonst rechtswidrig"
        case .other: return "Etwas anderes"
        }
    }
}

/// Etwas melden.
///
/// **Immer und überall erreichbar** — das ist eine Zusage und keine
/// Bequemlichkeit (M4 4.7, Art. 16 DSA).
protocol ReportRepository: Sendable {
    func file(kind: String, targetID: String, reason: ReportReason, body: String) async
        -> SaveOutcome
}

struct LiveReportRepository: ReportRepository {
    let backend: Backend

    nonisolated private struct NewReport: Encodable {
        let id: String
        let target_kind: String
        let target_id: String
        let reason: String
        let body: String?
        let reporter_id: String?
    }

    /// Die Id wird **hier** erzeugt, nicht von der Datenbank vergeben.
    ///
    /// Ein `insert().select()` bräuchte eine SELECT-Policy, und die gibt
    /// es nur für Moderatoren. Ohne sie meldet Postgres einen Verstoß
    /// beim Einfügen — der Fehler zeigt dann auf die falsche Hälfte.
    /// Dasselbe war im Web schon einmal der Fall.
    func file(kind: String, targetID: String, reason: ReportReason, body: String) async
        -> SaveOutcome
    {
        let text = body.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count <= 2000 else { return .failed("Höchstens 2000 Zeichen.") }

        do {
            try await backend.client
                .from("reports")
                .insert(
                    NewReport(
                        id: UUID().uuidString,
                        target_kind: kind,
                        target_id: targetID,
                        reason: reason.rawValue,
                        body: text.isEmpty ? nil : text,
                        reporter_id: backend.client.auth.currentUser?.id.uuidString
                    )
                )
                .execute()
            return .saved
        } catch {
            return .failed(BackendError.from(error).message)
        }
    }
}

/// Das Meldeformular.
struct ReportSheet: View {
    let targetKind: String
    let targetID: String

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos
    @FocusState private var isWriting: Bool

    @State private var reason: ReportReason = .harassment
    @State private var text = ""
    @State private var isSending = false
    @State private var note: String?
    @State private var isDone = false

    var body: some View {
        NavigationStack {
            Form {
                if isDone {
                    Section {
                        Text("Danke. Wir sehen uns das an.")
                            .font(.callout)
                            .foregroundStyle(Theme.foreground)
                            .listRowBackground(Theme.card)
                    }
                } else {
                    Section("Worum geht es") {
                        Picker("Grund", selection: $reason) {
                            ForEach(ReportReason.allCases) { option in
                                Text(option.label).tag(option)
                            }
                        }
                        .listRowBackground(Theme.card)
                    }

                    Section {
                        TextEditor(text: $text)
                            .frame(minHeight: 110)
                            .scrollContentBackground(.hidden)
                            .focused($isWriting)
                            .listRowBackground(Theme.card)
                    } header: {
                        Text("Was ist passiert (freiwillig)")
                    } footer: {
                        Text("\(text.count) von 2000 Zeichen")
                            .monospacedDigit()
                    }

                    if let note {
                        Section {
                            Text(note)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .listRowBackground(Theme.card)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle("Melden")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isDone ? "Schliessen" : "Abbrechen") { dismiss() }
                }
                if !isDone {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Senden") { Task { await send() } }
                            .disabled(isSending)
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    if isWriting {
                        Spacer()
                        Button("Fertig") { isWriting = false }
                    }
                }
            }
        }
    }

    private func send() async {
        note = nil
        isSending = true
        defer { isSending = false }
        isWriting = false

        switch await repos.reports.file(
            kind: targetKind, targetID: targetID, reason: reason, body: text)
        {
        case .saved: isDone = true
        case .failed(let message): note = message
        }
    }
}
