import SwiftUI
import UIKit

/// Filme suchen.
struct SearchView: View {
    @State private var model: SearchViewModel

    init(repository: FilmRepository, lazyFilms: LazyFilmRepository) {
        _model = State(
            initialValue: SearchViewModel(repository: repository, lazyFilms: lazyFilms))
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

                CreateFilmRow(
                    isBusy: model.isCreating,
                    isEnabled: model.canCreate
                ) {
                    // Erst die Tastatur weg, dann anlegen. Sonst steht
                    // sie vor der Zeremonie, und wegtippen geht nicht:
                    // ein Tippen auf den Vorhang überspringt sie.
                    dismissKeyboard()
                    Task { await model.createMissingFilm() }
                }
            }

            if let note = model.note {
                Text(note)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            ForEach(model.films) { film in
                FilmRow(film: film)
            }
        }
        .listStyle(.plain)
        // Wegwischen geht immer. Der Ziffernblock des Jahresfeldes hat
        // keine Return-Taste — ohne das hier kommt man aus ihm nicht
        // heraus, ausser über die Umschalttaste des Systems.
        .scrollDismissesKeyboard(.immediately)
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
        .overlay {
            if let building = model.building {
                CardBuildView(
                    film: building,
                    artwork: model.buildArtwork,
                    onDone: { model.finishBuilding() }
                )
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: model.building)
    }
}

/// Der Weg für einen Film, den der Katalog nicht hat.
private struct CreateFilmRow: View {
    let isBusy: Bool
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(
                "Nichts im Katalog. Wenn es den Film bei Wikidata gibt, "
                    + "kannst du ihn hier anlegen — danach steht er für alle bereit."
            )
            .font(.footnote)
            .foregroundStyle(.secondary)

            Button(action: action) {
                HStack(spacing: 8) {
                    if isBusy { ProgressView().controlSize(.small) }
                    Text(isBusy ? "Sucht bei Wikidata" : "Film anlegen")
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.primary)
            .foregroundStyle(Theme.onPrimary)
            .disabled(!isEnabled)
        }
        .padding(.vertical, 4)
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

    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "calendar")
                .foregroundStyle(.secondary)

            TextField("Jahr (optional)", text: $text)
                .keyboardType(.numberPad)
                .focused($isFocused)
                .toolbar {
                    // Der Ziffernblock bringt keine Return-Taste mit.
                    // Ohne diesen Knopf gibt es keinen Weg aus dem Feld
                    // heraus.
                    ToolbarItemGroup(placement: .keyboard) {
                        if isFocused {
                            Spacer()
                            Button("Fertig") { isFocused = false }
                        }
                    }
                }
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

/// Schliesst die Tastatur, egal welches Feld sie geöffnet hat.
///
/// Über den Responder und nicht über `@FocusState`: die Suchleiste
/// kommt von `.searchable` und führt ihren Fokus selbst, an ihn kommt
/// die Ansicht nicht heran.
@MainActor
func dismissKeyboard() {
    UIApplication.shared.sendAction(
        #selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
