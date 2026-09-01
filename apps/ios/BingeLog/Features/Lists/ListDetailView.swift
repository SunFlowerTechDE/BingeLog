import SwiftUI

/// Eine Binge-Liste (M5 5.6).
///
/// **Die Reihenfolge ist Teil der Aussage** — Platz eins heißt „damit
/// fängst du an". Deshalb steht die Nummer davor und wird nicht
/// sortiert.
struct ListDetailView: View {
    let list: ListSummary
    let isMine: Bool

    @Environment(Repositories.self) private var repos
    @Environment(\.dismiss) private var dismiss

    @State private var films: [ListFilm] = []
    @State private var isLoading = true
    @State private var isAdding = false
    @State private var isEditing = false
    @State private var confirmingDelete = false
    @State private var note: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if films.isEmpty {
                ContentUnavailableView(
                    "Noch nichts drin",
                    systemImage: "film",
                    description: Text(
                        isMine ? "Füg den ersten Film hinzu." : "Diese Liste ist leer.")
                )
            } else {
                content
            }
        }
        .background(Theme.background)
        .navigationTitle(list.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isMine {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Film hinzufügen", systemImage: "plus") { isAdding = true }
                        Button("Liste bearbeiten", systemImage: "pencil") { isEditing = true }
                        Button("Liste löschen", systemImage: "trash", role: .destructive) {
                            confirmingDelete = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Mehr")
                }
            }
        }
        .sheet(isPresented: $isAdding) {
            PickListFilmSheet { film in
                Task { await add(film) }
            }
        }
        .sheet(isPresented: $isEditing) {
            EditListSheet(list: list) { await load() }
        }
        .confirmationDialog(
            "Liste \(list.title) löschen?", isPresented: $confirmingDelete,
            titleVisibility: .visible
        ) {
            Button("Löschen", role: .destructive) { Task { await deleteList() } }
            Button("Abbrechen", role: .cancel) {}
        } message: {
            Text("Die Filme bleiben im Katalog, die Liste ist weg.")
        }
        .task { await load() }
        .refreshable { await load() }
    }

    private var content: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let description = list.description, !description.isEmpty {
                    Text(description)
                        .font(.callout)
                        .foregroundStyle(Theme.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(20)
                }

                ForEach(Array(films.enumerated()), id: \.element.id) { index, item in
                    NavigationLink {
                        FilmDetailView(film: item.film)
                    } label: {
                        row(index + 1, item)
                    }
                    .buttonStyle(.plain)
                    .contextMenu {
                        if isMine {
                            Button(
                                "Aus der Liste", systemImage: "minus.circle", role: .destructive
                            ) {
                                Task { await remove(item) }
                            }
                        }
                    }
                    Divider().overlay(Theme.border).padding(.leading, 20)
                }

                if let note {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(20)
                }
            }
        }
    }

    private func row(_ place: Int, _ item: ListFilm) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(place)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primary)
                .monospacedDigit()
                .frame(width: 22, alignment: .leading)

            PosterThumbnail(film: item.film, width: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.film.title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.foreground)
                    .lineLimit(2)
                if let year = item.releaseYear {
                    Text(String(year))
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()
                }
                if let text = item.note, !text.isEmpty {
                    Text(text)
                        .font(.caption2)
                        .foregroundStyle(Theme.muted)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    private func load() async {
        films = await repos.lists.films(in: list.id)
        isLoading = false
    }

    private func add(_ film: Film) async {
        note = nil
        // Hinten anhängen: `ord` ist die Länge, damit der neue Film
        // hinter dem letzten steht und nicht irgendwo dazwischen.
        switch await repos.lists.add(film: film.wikidataID, to: list.id, at: films.count) {
        case .saved: await load()
        case .failed(let message): note = message
        }
    }

    private func remove(_ item: ListFilm) async {
        note = nil
        films.removeAll { $0.filmID == item.filmID }
        switch await repos.lists.remove(film: item.filmID, from: list.id) {
        case .saved: break
        case .failed(let message):
            note = message
            await load()
        }
    }

    private func deleteList() async {
        switch await repos.lists.delete(id: list.id) {
        case .saved: dismiss()
        case .failed(let message): note = message
        }
    }
}

/// Eine Liste anlegen oder ändern.
struct EditListSheet: View {
    /// `nil` heisst: eine neue.
    let list: ListSummary?
    let onSaved: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos
    @FocusState private var isWriting: Bool

    @State private var title: String
    @State private var description: String
    @State private var isPublic: Bool
    @State private var isBusy = false
    @State private var note: String?

    init(list: ListSummary?, onSaved: @escaping () async -> Void) {
        self.list = list
        self.onSaved = onSaved
        _title = State(initialValue: list?.title ?? "")
        _description = State(initialValue: list?.description ?? "")
        _isPublic = State(initialValue: list?.isPublic ?? true)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Titel", text: $title)
                        .focused($isWriting)
                        .listRowBackground(Theme.card)
                } footer: {
                    Text("\(title.count) von 80 Zeichen")
                        .monospacedDigit()
                        .foregroundStyle(title.count > 80 ? .red : Theme.quiet)
                }

                Section("Worum geht es") {
                    TextEditor(text: $description)
                        .frame(minHeight: 80)
                        .scrollContentBackground(.hidden)
                        .focused($isWriting)
                        .listRowBackground(Theme.card)
                }

                Section {
                    Toggle("Öffentlich", isOn: $isPublic)
                        .listRowBackground(Theme.card)
                } footer: {
                    Text(
                        isPublic
                            ? "Die Liste steht auf deinem Profil."
                            : "Nur du siehst sie.")
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
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle(list == nil ? "Neue Liste" : "Liste bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") { Task { await save() } }
                        .disabled(
                            isBusy
                                || title.trimmingCharacters(in: .whitespaces).isEmpty
                                || title.count > 80)
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

    private func save() async {
        note = nil
        isBusy = true
        defer { isBusy = false }

        let outcome: SaveOutcome
        if let list {
            outcome = await repos.lists.update(
                id: list.id, title: title, description: description, isPublic: isPublic)
        } else {
            outcome = await repos.lists.create(
                title: title, description: description, isPublic: isPublic)
        }

        switch outcome {
        case .saved:
            await onSaved()
            dismiss()
        case .failed(let message):
            note = message
        }
    }
}

/// Einen Film für eine Liste suchen.
///
/// Nur aus dem Katalog — dieselbe Regel wie bei den Favoriten: eine
/// Liste zu füllen ist kein Anlass, den Katalog zu erweitern.
private struct PickListFilmSheet: View {
    let onPick: (Film) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos

    @State private var term = ""
    @State private var films: [Film] = []
    @State private var task: Task<Void, Never>?

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
            .searchable(text: $term, prompt: "Film suchen")
            .overlay {
                if films.isEmpty {
                    ContentUnavailableView(
                        "Such einen Film",
                        systemImage: "magnifyingglass",
                        description: Text("Ab zwei Zeichen wird gesucht.")
                    )
                }
            }
            .navigationTitle("Film hinzufügen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .onChange(of: term) { _, value in
                task?.cancel()
                task = Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard !Task.isCancelled else { return }
                    films = (try? await repos.films.search(term: value, limit: 20, year: nil)) ?? []
                }
            }
        }
    }
}
