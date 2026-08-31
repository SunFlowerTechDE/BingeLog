import SwiftUI

/// Die zehn Favoritenplätze belegen.
///
/// **Die Reihenfolge ist Teil der Aussage** — Platz eins ist Platz eins.
/// Deshalb gibt es Plätze und keine Menge: ein Film wird auf einen Platz
/// gesetzt, nicht zu einer Sammlung hinzugefügt.
struct EditFavouritesSheet: View {
    let slots: [FavouriteSlot]
    let onChanged: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos

    @State private var picking: Int?
    @State private var note: String?
    @State private var isBusy = false

    /// Zehn, seit dem 31.08.2026. Die Zahl steht auch als CHECK in der
    /// Tabelle; hier steht sie, damit die Oberfläche nicht mehr anbietet
    /// als die Datenbank nimmt.
    private static let places = 10

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(1...Self.places, id: \.self) { place in
                        row(place)
                    }
                } footer: {
                    Text("Platz eins steht vorn. Ein Film kann nur einen Platz belegen.")
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
            .background(Theme.background)
            .navigationTitle("Favoriten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
            .sheet(item: $picking) { place in
                PickFilmSheet { film in
                    Task { await set(place: place, film: film.wikidataID) }
                }
            }
        }
    }

    private func row(_ place: Int) -> some View {
        let slot = slots.first { $0.slot == place }

        return HStack(spacing: 12) {
            Text("\(place)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Theme.primary)
                .monospacedDigit()
                .frame(width: 22, alignment: .leading)

            if let slot {
                PosterThumbnail(film: slot.film, width: 34)
                VStack(alignment: .leading, spacing: 1) {
                    Text(slot.film.title)
                        .font(.subheadline)
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(1)
                    if let year = slot.releaseYear {
                        Text(String(year))
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                            .monospacedDigit()
                    }
                }
                Spacer(minLength: 0)
                Button("Räumen") { Task { await set(place: place, film: nil) } }
                    .font(.caption)
                    .foregroundStyle(Theme.quiet)
                    .buttonStyle(.plain)
            } else {
                Button("Film wählen") { picking = place }
                    .font(.subheadline)
                    .foregroundStyle(Theme.primary)
                    .buttonStyle(.plain)
                Spacer(minLength: 0)
            }
        }
        .disabled(isBusy)
        .listRowBackground(Theme.card)
    }

    private func set(place: Int, film: String?) async {
        note = nil
        isBusy = true
        defer { isBusy = false }

        switch await repos.profileEdits.setFavourite(slot: place, film: film) {
        case .saved: onChanged()
        case .failed(let message): note = message
        }
    }
}

/// Einen Film für einen Platz suchen.
///
/// Nur aus dem Katalog: einen Favoriten anzulegen ist kein Anlass, den
/// Katalog zu erweitern. Wer einen Film vermisst, findet ihn über die
/// Suche und legt ihn dort an.
private struct PickFilmSheet: View {
    let onPick: (Film) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos

    @State private var term = ""
    @State private var films: [Film] = []
    @State private var isSearching = false
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
                            Text(film.title)
                                .foregroundStyle(Theme.foreground)
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
                if films.isEmpty, !isSearching {
                    ContentUnavailableView(
                        "Such einen Film",
                        systemImage: "magnifyingglass",
                        description: Text("Ab zwei Zeichen wird gesucht.")
                    )
                }
            }
            .navigationTitle("Film wählen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
            .onChange(of: term) { _, value in
                // Gebremst und abbrechbar, wie in der Suche: eine
                // Anfrage je Tastendruck wäre eine zu viel.
                task?.cancel()
                task = Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard !Task.isCancelled else { return }
                    isSearching = true
                    defer { isSearching = false }
                    films = (try? await repos.films.search(term: value, limit: 20, year: nil)) ?? []
                }
            }
        }
    }
}

/// Damit `sheet(item:)` mit einer Zahl umgehen kann.
extension Int: @retroactive Identifiable {
    public var id: Int { self }
}
