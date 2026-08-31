import SwiftUI

/// Den Film an Freunde schicken.
///
/// **Nur an Freunde**, also an Leute, denen man folgt und die
/// zurückfolgen. Einseitig wäre es keine Empfehlung, sondern ein Kanal,
/// über den jeder jedem etwas in die Startseite schreiben kann.
///
/// Diese Liste ist eine Auswahl, keine Regel: wer wirklich empfehlen
/// darf, entscheidet die Policy auf `recommendations`. Wer dazwischen
/// entfolgt oder blockiert, bekommt hier nichts — Postgres weist es ab,
/// und der Fehler steht dann darunter.
struct RecommendSheet: View {
    let film: Film
    let entries: FilmEntryRepository

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isWriting: Bool

    @State private var friends: [RecommendationTarget] = []
    @State private var chosen: Set<UUID> = []
    @State private var note = ""
    @State private var isLoading = true
    @State private var isSending = false
    @State private var problem: String?

    /// Fünfzig Zeichen, wie die Spalte sie führt.
    private static let noteLimit = 50

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if friends.isEmpty {
                    ContentUnavailableView(
                        "Noch keine Freunde",
                        systemImage: "person.2",
                        description: Text(
                            "Empfehlen geht unter Freunden — also wenn ihr euch "
                                + "gegenseitig folgt.")
                    )
                } else {
                    list
                }
            }
            .background(Theme.background)
            .navigationTitle("Empfehlen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Senden") { Task { await send() } }
                        .disabled(chosen.isEmpty || isSending)
                }
            }
            .task { await load() }
        }
    }

    private var list: some View {
        List {
            Section {
                ForEach(friends) { friend in
                    Button {
                        toggle(friend.id)
                    } label: {
                        HStack(spacing: 12) {
                            Image(
                                systemName: chosen.contains(friend.id)
                                    ? "checkmark.circle.fill" : "circle"
                            )
                            .foregroundStyle(
                                chosen.contains(friend.id) ? Theme.primary : Theme.quiet)

                            Text(friend.username)
                                .foregroundStyle(Theme.foreground)

                            Spacer()

                            // Schon geschickt heisst nicht gesperrt: eine
                            // zweite Empfehlung überschreibt die erste,
                            // etwa um die Notiz zu ändern.
                            if friend.alreadySent {
                                Text("schon geschickt")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.quiet)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                    .listRowBackground(Theme.card)
                }
            } header: {
                Text("An wen")
            }

            Section {
                TextField("Kurze Nachricht", text: $note, axis: .vertical)
                    .focused($isWriting)
                    .onChange(of: note) {
                        // Abgeschnitten statt abgewiesen: die Grenze
                        // steht daneben und ist mitgezählt.
                        if note.count > Self.noteLimit {
                            note = String(note.prefix(Self.noteLimit))
                        }
                    }
                    .listRowBackground(Theme.card)
            } header: {
                Text("Nachricht (optional)")
            } footer: {
                Text("\(note.count) von \(Self.noteLimit) Zeichen")
                    .monospacedDigit()
            }

            if let problem {
                Section {
                    Text(problem)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .listRowBackground(Theme.card)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                if isWriting {
                    Spacer()
                    Button("Fertig") { isWriting = false }
                }
            }
        }
    }

    private func toggle(_ id: UUID) {
        if chosen.contains(id) {
            chosen.remove(id)
        } else {
            chosen.insert(id)
        }
    }

    private func load() async {
        friends = await entries.friendsForRecommendation(film: film.wikidataID)
        isLoading = false
    }

    private func send() async {
        problem = nil
        isSending = true
        defer { isSending = false }

        switch await entries.recommend(
            film: film.wikidataID, to: Array(chosen), note: note)
        {
        case .saved:
            dismiss()
        case .failed(let message):
            problem = message
        }
    }
}
