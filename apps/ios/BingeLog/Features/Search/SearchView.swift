import SwiftUI

/// Filme suchen.
struct SearchView: View {
    @State private var model: SearchViewModel

    init(repository: FilmRepository) {
        _model = State(initialValue: SearchViewModel(repository: repository))
    }

    var body: some View {
        @Bindable var model = model

        List {
            if let problem = model.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if model.term.count >= 2, model.films.isEmpty, !model.isSearching {
                Text("Nichts gefunden.")
                    .foregroundStyle(.secondary)
            }

            ForEach(model.films) { film in
                FilmRow(film: film)
            }
        }
        .listStyle(.plain)
        .searchable(
            text: $model.term,
            placement: .navigationBarDrawer(displayMode: .always),
            prompt: "Film suchen"
        )
        .overlay {
            if model.term.isEmpty {
                ContentUnavailableView(
                    "Such einen Film",
                    systemImage: "magnifyingglass",
                    description: Text("Tipp einen Titel. Ab zwei Zeichen wird gesucht.")
                )
            }
        }
        .navigationTitle("Suche")
    }
}

/// Eine Zeile in der Trefferliste.
private struct FilmRow: View {
    let film: Film

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: film.posterAddress(webBase: URL(string: "https://bingelog.eu")!)) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Rectangle().fill(.quaternary)
            }
            .frame(width: 44, height: 66)
            .clipShape(RoundedRectangle(cornerRadius: 4))

            VStack(alignment: .leading, spacing: 2) {
                Text(film.title)
                    // Keine feste Schriftgröße: Dynamic Type muss
                    // greifen (M5 5.4).
                    .font(.body)
                if let year = film.releaseYear {
                    Text(String(year))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
