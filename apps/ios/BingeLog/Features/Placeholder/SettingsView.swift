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
    @State private var showsDeletion = false
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

            // Zwei Hürden, beide mit Absicht: erst der Knopf, dann der
            // eigene Name. Das ist der einzige Schritt in der App, den
            // niemand rückgängig machen kann.
            Section {
                Button("Konto löschen", role: .destructive) {
                    showsDeletion = true
                }
            } footer: {
                Text(
                    "Tagebuch, Bewertungen, Listen und Bilder werden gelöscht und lassen "
                        + "sich nicht wiederherstellen.")
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

            // Der Text steht auf der Webseite, nicht in der App. Zwei
            // Fassungen eines Rechtstexts laufen auseinander, und man
            // merkt es erst, wenn jemand fragt.
            if let url = AppConfiguration.privacyPolicyURL {
                Section("Rechtliches") {
                    Link(destination: url) {
                        HStack {
                            Text("Datenschutzerklärung")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .font(.caption)
                                .foregroundStyle(Theme.muted)
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
        .sheet(isPresented: $showsDeletion) {
            DeleteAccountSheet()
        }
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
        Planned(title: "Nutzungsbedingungen", step: "M6"),
        Planned(title: "Impressum", step: "M6"),
    ]
}

/// Konto löschen — die zweite Hürde (Art. 17 DSGVO).
///
/// Der eigene Name muss abgetippt werden. Ein Knopf allein wäre zu
/// wenig für den einzigen Schritt in der App, den niemand rückgängig
/// machen kann.
private struct DeleteAccountSheet: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    @State private var bestaetigung = ""
    @State private var laeuft = false
    @State private var problem: String?
    @FocusState private var isTyping: Bool

    private var name: String { session.username ?? "" }
    private var passt: Bool {
        bestaetigung.trimmingCharacters(in: .whitespaces) == name && !name.isEmpty
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(
                        "Dein Tagebuch, deine Bewertungen, Rezensionen, Listen, Bilder und "
                            + "Beiträge werden gelöscht und lassen sich nicht wiederherstellen."
                    )
                    .font(.footnote)
                    .foregroundStyle(Theme.foreground)

                    Text(
                        "Stehen bleiben nur Meldungen und Moderationsentscheidungen — ohne "
                            + "deinen Namen daran."
                    )
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                }

                Section {
                    TextField("Benutzername", text: $bestaetigung)
                        .focused($isTyping)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.done)
                } header: {
                    Text("Tipp zur Bestätigung \(name) ein")
                }

                if let problem {
                    Section {
                        Text(problem).font(.footnote).foregroundStyle(.red)
                    }
                }

                Section {
                    Button(role: .destructive) {
                        loeschen()
                    } label: {
                        HStack {
                            Text("Endgültig löschen")
                            if laeuft {
                                Spacer()
                                ProgressView()
                            }
                        }
                    }
                    .disabled(!passt || laeuft)
                }
            }
            .navigationTitle("Konto löschen")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Fertig") { isTyping = false }
                }
            }
        }
    }

    private func loeschen() {
        laeuft = true
        problem = nil

        Task {
            let ergebnis = await session.deleteAccount()
            laeuft = false

            switch ergebnis {
            case .saved:
                // Die Sitzung ist weg; `RootView` zeigt von selbst
                // wieder das Anmelden. Das Blatt zu schliessen genuegt.
                dismiss()
            case .failed(let meldung):
                problem = meldung
            }
        }
    }
}
