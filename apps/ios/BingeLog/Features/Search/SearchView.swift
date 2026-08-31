import SwiftUI
import UIKit

/// Filme suchen.
struct SearchView: View {
    @State private var model: SearchViewModel

    private let details: FilmDetailRepository
    private let entries: FilmEntryRepository

    init(
        repository: FilmRepository, lazyFilms: LazyFilmRepository,
        details: FilmDetailRepository,
        entries: FilmEntryRepository
    ) {
        self.details = details
        self.entries = entries
        _model = State(
            initialValue: SearchViewModel(
                repository: repository, lazyFilms: lazyFilms, entries: entries))
    }

    var body: some View {
        @Bindable var model = model

        List {
            // Das Jahr steht über der Trefferliste und nicht in der
            // Suchleiste: die gehört dem Titel. Eine Leiste mit zwei
            // Feldern ist eine Leiste, in der man das falsche trifft.
            YearField(text: $model.yearText, isIncomplete: model.yearIsIncomplete)
                .listRowSeparator(.hidden)

            if model.term.isEmpty, !model.history.isEmpty {
                Section {
                    ForEach(model.history, id: \.self) { term in
                        Button {
                            model.use(term)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.caption)
                                    .foregroundStyle(Theme.quiet)
                                Text(term).foregroundStyle(Theme.foreground)
                                Spacer(minLength: 0)
                            }
                        }
                        .buttonStyle(.plain)
                        .swipeActions {
                            Button("Löschen", role: .destructive) { model.forget(term) }
                        }
                    }
                } header: {
                    HStack {
                        Text("Zuletzt gesucht")
                        Spacer()
                        Button("Alle löschen") { model.clearHistory() }
                            .font(.caption)
                            .foregroundStyle(Theme.primary)
                    }
                }
            }

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

                LookOutsideRow(
                    isBusy: model.isCreating,
                    isEnabled: model.canCreate
                ) {
                    // Erst die Tastatur weg, dann suchen. Sonst steht
                    // sie vor der Prüfkarte.
                    dismissKeyboard()
                    Task { await model.lookOutside() }
                }
            }

            if let note = model.note {
                VStack(alignment: .leading, spacing: 8) {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.secondary)

                    // „Ohne Jahresfilter suchen" statt eines leeren
                    // Zustands (Suchkonzept, 3).
                    if model.offersDroppingTheYear {
                        Button("Ohne Jahr suchen") {
                            Task { await model.retryWithoutYear() }
                        }
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(Theme.primary)
                    }
                }
            }

            // Mehrere Treffer: der Nutzer entscheidet, welcher gemeint
            // ist. „Halloween" gibt es dreimal (Suchkonzept, 14).
            if model.candidates.count > 1 {
                Section("Ausserhalb des Katalogs gefunden") {
                    ForEach(model.candidates) { candidate in
                        Button {
                            model.inspecting = candidate
                        } label: {
                            CandidateRow(candidate: candidate)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            ForEach(model.films) { film in
                NavigationLink {
                    FilmDetailView(film: film)
                } label: {
                    FilmRow(
                        film: film,
                        isSeen: model.seen.contains(film.wikidataID),
                        isOnWatchlist: model.onWatchlist.contains(film.wikidataID)
                    )
                }
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
            if model.term.isEmpty, model.yearText.isEmpty, model.history.isEmpty {
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
        .sheet(item: $model.inspecting) { candidate in
            CandidateSheet(candidate: candidate) {
                Task { await model.adopt(candidate) }
            }
        }
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
        // Die Menüleiste fährt nach unten weg, solange die Karte
        // entsteht, und danach wieder hoch. Ohne das steht sie im
        // Vordergrund vor dem Vorhang — die Zeremonie nimmt den ganzen
        // Bildschirm ein oder sie nimmt ihn nicht ein.
        .toolbar(model.building == nil ? .visible : .hidden, for: .tabBar)
        .animation(.easeInOut(duration: 0.35), value: model.building == nil)
        .animation(.easeInOut(duration: 0.3), value: model.building)
    }
}

/// Der Weg für einen Film, den der Katalog nicht hat.
private struct LookOutsideRow: View {
    let isBusy: Bool
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Die Quelle wird nicht genannt (Suchkonzept, 6). Der
            // Nutzer soll verstehen, dass ausserhalb des Katalogs
            // gesucht wird — woher die Daten kommen, hilft ihm nicht.
            Text(
                "Nicht in unserem Katalog gefunden. "
                    + "Wir können ausserhalb weitersuchen — was du aufnimmst, "
                    + "steht danach für alle bereit."
            )
            .font(.footnote)
            .foregroundStyle(.secondary)

            Button(action: action) {
                HStack(spacing: 8) {
                    if isBusy { ProgressView().controlSize(.small) }
                    // „Film anlegen" klang nach einer Verwaltungstätigkeit
                    // (Suchkonzept, 7).
                    Text(isBusy ? "Wir suchen den Film" : "Weiter suchen")
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
    var isSeen = false
    var isOnWatchlist = false

    var body: some View {
        HStack(spacing: 12) {
            // Ueber `PosterThumbnail` und nicht ueber `AsyncImage`:
            // sonst bleibt die prozedurale Karte leer, und die hat
            // gerade ein frisch angelegter Film fast immer.
            PosterThumbnail(film: film, width: 44)

            VStack(alignment: .leading, spacing: 2) {
                Text(film.title)
                    // Keine feste Schriftgröße: Dynamic Type muss
                    // greifen (M5 5.4).
                    .font(.body)

                // Der Originaltitel, wenn er ein anderer ist. „Die
                // Eiskönigin / Frozen" macht sofort klar, dass es
                // derselbe Film ist (Suchkonzept, 2).
                if film.titleOriginal != film.title {
                    Text(film.titleOriginal)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 8) {
                    if let year = film.releaseYear {
                        Text(String(year))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .monospacedDigit()
                    }

                    // Klein und ohne Knopf: die Suche bleibt Navigation
                    // (Suchkonzept, 28 und 29).
                    if isSeen {
                        StatusTag(text: "Gesehen", symbol: "checkmark")
                    } else if isOnWatchlist {
                        StatusTag(text: "In Watchlist", symbol: "bookmark.fill")
                    }
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

/// Ein Treffer von draussen, in der Liste.
private struct CandidateRow: View {
    let candidate: FilmCandidate

    var body: some View {
        HStack(spacing: 12) {
            // Ein echtes Plakat, falls es eins gibt. Den Film gibt es
            // noch nicht, also auch keine prozedurale Karte.
            AsyncImage(url: candidate.posterURL.flatMap(URL.init(string:))) { image in
                image.resizable().aspectRatio(contentMode: .fill)
            } placeholder: {
                Rectangle().fill(Theme.card)
            }
            .frame(width: 44, height: 66)
            .clipShape(RoundedRectangle(cornerRadius: 4))

            VStack(alignment: .leading, spacing: 2) {
                Text(candidate.title)
                    .foregroundStyle(Theme.foreground)
                if let other = candidate.alternativeTitle {
                    Text(other)
                        .font(.caption)
                        .foregroundStyle(Theme.muted)
                }
                Text(candidate.facts)
                    .font(.caption)
                    .foregroundStyle(Theme.quiet)
                    .monospacedDigit()
            }

            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Theme.quiet)
        }
        .padding(.vertical, 2)
    }
}

/// Die Prüfkarte vor der Aufnahme (Suchkonzept, 8).
///
/// Plakat, Titel, Originaltitel, Jahr, Regie und Laufzeit — genug, um zu
/// erkennen, ob es wirklich der gesuchte Film ist. Erst der Knopf legt
/// ihn an.
private struct CandidateSheet: View {
    let candidate: FilmCandidate
    let onAdopt: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                AsyncImage(url: candidate.posterURL.flatMap(URL.init(string:))) { image in
                    image.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Theme.card)
                        .overlay {
                            Image(systemName: "film")
                                .font(.largeTitle)
                                .foregroundStyle(Theme.quiet)
                        }
                }
                .frame(width: 150, height: 225)
                .clipShape(RoundedRectangle(cornerRadius: 10))

                Text(candidate.title)
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .multilineTextAlignment(.center)

                if let other = candidate.alternativeTitle {
                    Text(other)
                        .font(.subheadline)
                        .foregroundStyle(Theme.muted)
                        .multilineTextAlignment(.center)
                }

                Text(candidate.facts)
                    .font(.footnote)
                    .foregroundStyle(Theme.quiet)
                    .monospacedDigit()

                Text("Ist das der richtige Film? Danach steht er für alle im Katalog.")
                    .font(.caption2)
                    .foregroundStyle(Theme.quiet)
                    .multilineTextAlignment(.center)
                    .padding(.top, 4)

                Spacer()

                Button {
                    onAdopt()
                    dismiss()
                } label: {
                    Text("Film hinzufügen")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                }
                .background(Theme.primary, in: RoundedRectangle(cornerRadius: 10))
                .foregroundStyle(Theme.onPrimary)
                .font(.headline)
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(Theme.background)
            .navigationTitle("Gefunden")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }
}

/// Eine kleine Kennzeichnung in der Trefferliste.
private struct StatusTag: View {
    let text: String
    let symbol: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: symbol).font(.system(size: 9))
            Text(text).font(.caption2)
        }
        .foregroundStyle(Theme.primary)
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .overlay { Capsule().strokeBorder(Theme.primary.opacity(0.4)) }
    }
}
