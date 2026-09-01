import SwiftUI

/// Einstellungen.
///
/// Noch kaum etwas — aber **das Abmelden steht hier und wirklich**, weil
/// es das vorher unter „Konto" gab. Eine Funktion, die es gab, darf
/// beim Umbauen nicht verschwinden.
struct SettingsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(ImportRunner.self) private var runner

    var body: some View {
        List {
            Section {
                LabeledContent("Angemeldet als", value: session.username ?? "—")
            }

            Section {
                Button("Abmelden", role: .destructive) {
                    Task { await session.signOut() }
                }
            }

            Section("Daten und Import") {
                NavigationLink {
                    ImportView()
                } label: {
                    HStack {
                        Text("Von Letterboxd importieren")
                        Spacer()
                        // Läuft gerade einer, steht der Stand hier —
                        // sonst müsste man die Seite öffnen, um zu
                        // sehen, ob überhaupt noch etwas passiert.
                        if runner.isRunning {
                            Text("\(runner.processed) von \(runner.total)")
                                .font(.caption2)
                                .foregroundStyle(Theme.primary)
                                .monospacedDigit()
                        }
                    }
                }
                .listRowBackground(Theme.card)
            }

            Section("Kommt noch") {
                // Ausgegraut und benannt statt weggelassen: so ist
                // sichtbar, was hier hingehört, ohne dass etwas
                // vorgibt zu gehen.
                ForEach(SettingsView.planned, id: \.title) { item in
                    LabeledContent(item.title, value: item.step)
                        .foregroundStyle(Theme.quiet)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.background)
        .navigationTitle("Einstellungen")
    }

    private struct Planned {
        let title: String
        let step: String
    }

    private static let planned: [Planned] = [
        Planned(title: "Konto und Passwort", step: "M5 5.6"),
        Planned(title: "Benachrichtigungen", step: "M6"),
        Planned(title: "Datenschutz", step: "M6"),
        Planned(title: "Nutzungsbedingungen", step: "M6"),
        Planned(title: "Impressum", step: "M6"),
    ]
}
