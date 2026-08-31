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
            // Das Jahr steht über der Trefferliste und nicht in der
            // Suchleiste: die gehört dem Titel. Eine Leiste mit zwei
            // Feldern ist eine Leiste, in der man das falsche trifft.
            YearField(text: $model.yearText, isIncomplete: model.yearIsIncomplete)
                .listRowSeparator(.hidden)

            if let problem = model.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            if model.term.count >= 2, model.films.isEmpty, !model.isSearching {
                // Mit Jahr ist die häufigste Ursache das Jahr, nicht der
                // Titel. Das zu sagen erspart das Rätselraten.
                Text(
                    model.year == nil
                        ? "Nichts gefunden."
                        : "Nichts gefunden. Ohne das Jahr gibt es vielleicht Treffer."
                )
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
            if model.term.isEmpty, model.yearText.isEmpty {
                ContentUnavailableView(
                    "Such einen Film",
                    systemImage: "magnifyingglass",
                    description: Text(
                        "Tipp einen Titel. Ab zwei Zeichen wird gesucht. "
                            + "Das Jahr kannst du dazuschreiben, musst du aber nicht."
                    )
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

/// Das Jahr, vier Ziffern, freiwillig.
private struct YearField: View {
    @Binding var text: String
    let isIncomplete: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "calendar")
                .foregroundStyle(.secondary)

            TextField("Jahr (optional)", text: $text)
                .keyboardType(.numberPad)
                .textContentType(.none)
                .autocorrectionDisabled()
                // YYYY: mehr als vier Ziffern nimmt das Feld gar nicht
                // erst an, das erledigt `SearchViewModel.onlyDigits`.
                .monospacedDigit()

            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Jahr löschen")
            }
        }
        .overlay(alignment: .bottomLeading) {
            // Sagt, warum noch nichts passiert. Ohne den Hinweis wirkt
            // ein halb getipptes Jahr wie ein Feld ohne Wirkung.
            if isIncomplete {
                Text("Vier Ziffern, zum Beispiel 1999")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .offset(y: 16)
            }
        }
        .padding(.bottom, isIncomplete ? 16 : 0)
    }
}
