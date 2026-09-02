import SwiftUI

/// Was der Import nicht zuordnen konnte.
///
/// Einzelne Fehler blockieren den Import nicht — der Rest läuft durch,
/// und was übrigbleibt, steht hier. Der Nutzer wählt den richtigen Film
/// oder legt den Eintrag beiseite.
struct UnmatchedView: View {
    @Environment(Repositories.self) private var repos

    @State private var items: [UnmatchedItem] = []
    @State private var isLoading = true
    @State private var picking: UnmatchedItem?
    @State private var note: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if items.isEmpty {
                ContentUnavailableView(
                    "Alles zugeordnet",
                    systemImage: "checkmark.circle",
                    description: Text("Aus deinen Importen ist nichts offen.")
                )
            } else {
                list
            }
        }
        .background(Theme.background)
        .navigationTitle("Nicht erkannt")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $picking) { item in
            PickForImportSheet(item: item) { film in
                Task { await assign(item, film: film) }
            }
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var list: some View {
        List {
            Section {
                ForEach(items) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(item.label)
                            .font(.subheadline)
                            .foregroundStyle(Theme.foreground)

                        HStack(spacing: 14) {
                            Button("Film suchen") { picking = item }
                                .font(.caption)
                                .foregroundStyle(Theme.primary)
                            Button("Überspringen") { Task { await skip(item) } }
                                .font(.caption)
                                .foregroundStyle(Theme.quiet)
                        }
                        .buttonStyle(.plain)
                    }
                    .listRowBackground(Theme.card)
                }
            } footer: {
                Text(
                    "Diese Einträge ließen sich nicht sicher zuordnen. Such den richtigen "
                        + "Film oder leg sie beiseite."
                )
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
        .scrollContentBackground(.hidden)
    }

    private func load() async {
        items = await repos.imports.unmatched(limit: 200)
        isLoading = false
    }

    private func assign(_ item: UnmatchedItem, film: Film) async {
        note = nil
        // Sofort aus der Liste nehmen: eine Zeile, die erst nach der
        // Antwort verschwindet, fühlt sich kaputt an.
        items.removeAll { $0.id == item.id }

        let ok = await repos.imports.resolve(
            item: item.id, film: film.wikidataID, batch: item.batchID)
        if !ok {
            note = "Das hat nicht geklappt."
            await load()
        }
    }

    private func skip(_ item: UnmatchedItem) async {
        items.removeAll { $0.id == item.id }
        _ = await repos.imports.skip(item: item.id)
    }
}

/// Den richtigen Film aus dem Katalog wählen.
///
/// Vorbelegt mit dem Titel aus der Datei — meistens stimmt er, und die
/// Zuordnung ist am Jahr gescheitert.
private struct PickForImportSheet: View {
    let item: UnmatchedItem
    let onPick: (Film) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos

    @State private var term: String
    @State private var films: [Film] = []
    @State private var task: Task<Void, Never>?

    init(item: UnmatchedItem, onPick: @escaping (Film) -> Void) {
        self.item = item
        self.onPick = onPick
        _term = State(initialValue: item.rawTitle)
    }

    var body: some View {
        NavigationStack {
            List(films) { film in
                Button {
                    onPick(film)
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        PosterThumbnail(film: film, width: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(film.title).foregroundStyle(Theme.foreground)
                            if let year = film.releaseYear {
                                Text(String(year))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.quiet)
                                    .monospacedDigit()
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
                .listRowBackground(Theme.card)
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .searchable(text: $term, prompt: "Titel")
            .overlay {
                if films.isEmpty {
                    ContentUnavailableView(
                        "Nichts im Katalog",
                        systemImage: "magnifyingglass",
                        description: Text(
                            "Such den Film über die Suche — dort kannst du ihn hinzufügen.")
                    )
                }
            }
            .navigationTitle(item.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .task { await search(term) }
            .onChange(of: term) { _, value in
                task?.cancel()
                task = Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard !Task.isCancelled else { return }
                    await search(value)
                }
            }
        }
    }

    private func search(_ value: String) async {
        films = (try? await repos.films.search(term: value, limit: 20, year: nil)) ?? []
    }
}
