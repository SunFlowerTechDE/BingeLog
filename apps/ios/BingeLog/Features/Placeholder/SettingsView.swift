import SwiftUI

/// Einstellungen.
///
/// Noch kaum etwas — aber **das Abmelden steht hier und wirklich**, weil
/// es das vorher unter „Konto" gab. Eine Funktion, die es gab, darf
/// beim Umbauen nicht verschwinden.
struct SettingsView: View {
    @Environment(SessionStore.self) private var session
    @Environment(ImportRunner.self) private var runner
    @Environment(Repositories.self) private var repos

    @State private var unmatched = 0
    @State private var readiness: TasteReadiness = .empty

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

            Section {
                NavigationLink {
                    TasteView(taste: repos.taste, entries: repos.entries)
                } label: {
                    HStack {
                        Text("Geschmackscheck")
                        Spacer()
                        // Der Stand gleich hier: wer nicht sieht, wie
                        // weit er ist, macht auch nicht weiter.
                        Text("\(readiness.readiness) von 100")
                            .font(.caption2)
                            .foregroundStyle(readiness.isUsable ? Theme.primary : Theme.muted)
                            .monospacedDigit()
                    }
                }
                .listRowBackground(Theme.card)
            } header: {
                Text("Vorschläge")
            } footer: {
                Text(
                    "Plakate durchblättern und sagen, was dich reizt. Das ist keine "
                        + "Bewertung — es macht nur die Vorschläge besser.")
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

                // Nur wenn es etwas zu klären gibt. Ein Eintrag „Nicht
                // erkannt", hinter dem nichts steht, ist eine Aufgabe,
                // die es nicht gibt.
                if unmatched > 0 {
                    NavigationLink {
                        UnmatchedView()
                    } label: {
                        HStack {
                            Text("Nicht erkannt")
                            Spacer()
                            Text("\(unmatched)")
                                .font(.caption2)
                                .foregroundStyle(Theme.primary)
                                .monospacedDigit()
                        }
                    }
                    .listRowBackground(Theme.card)
                }
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
        .task {
            unmatched = await repos.imports.unmatched(limit: 200).count
            readiness = await repos.taste.readiness()
        }
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
