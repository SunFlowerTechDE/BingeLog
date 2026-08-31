import SwiftUI

/// Das Tagebuch (M5 5.4).
///
/// Nach Monat gruppiert, weil man sich so daran erinnert: „im August
/// habe ich viel gesehen" ist eine Aussage, „Eintrag 47" ist keine.
/// Darüber drei Zahlen, darunter Suche, Sortierung und ein paar Filter.
struct DiaryView: View {
    @State private var model: DiaryModel
    private let details: FilmDetailRepository
    private let entries: FilmEntryRepository

    @State private var editing: DiaryEntry?

    init(entries: FilmEntryRepository, details: FilmDetailRepository) {
        self.entries = entries
        self.details = details
        _model = State(initialValue: DiaryModel(entries: entries))
    }

    var body: some View {
        @Bindable var model = model

        Group {
            if model.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if model.all.isEmpty {
                empty
            } else {
                filled
            }
        }
        .background(Theme.background)
        .navigationTitle("Tagebuch")
        .searchable(
            text: $model.term,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "Im Tagebuch suchen"
        )
        .toolbar {
            if !model.all.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Sortieren", selection: $model.order) {
                            ForEach(DiaryOrder.allCases) { option in
                                Text(option.label).tag(option)
                            }
                        }
                    } label: {
                        Image(systemName: "arrow.up.arrow.down")
                    }
                    .accessibilityLabel("Sortieren")
                }
            }
        }
        .sheet(item: $editing) { entry in
            EditEntrySheet(entry: entry) { rating, watchedOn, review, spoilers, visibility in
                Task {
                    await model.save(
                        entry, rating: rating, watchedOn: watchedOn, review: review,
                        hasSpoilers: spoilers, visibility: visibility)
                }
            } onDelete: {
                Task { await model.delete(entry) }
            }
        }
        .task { await model.load() }
        .refreshable { await model.load() }
    }

    private var empty: some View {
        VStack(spacing: 14) {
            Image(systemName: "calendar")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Theme.primary.opacity(0.6))
            Text("Hier steht, was du wann gesehen hast.")
                .font(.callout)
                .foregroundStyle(Theme.foreground)
            Text("Such einen Film und tipp auf einen Eimer Popcorn.")
                .font(.footnote)
                .foregroundStyle(Theme.muted)
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(24)
    }

    private var filled: some View {
        @Bindable var model = model

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 18, pinnedViews: [.sectionHeaders]) {
                numbers
                if model.availableYears.count > 1 { years }
                filters

                if model.shown.isEmpty {
                    Text("Nichts passt zu dieser Auswahl.")
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .padding(.horizontal, 20)
                }

                ForEach(model.months) { month in
                    Section {
                        VStack(spacing: 0) {
                            ForEach(month.entries) { entry in
                                NavigationLink {
                                    FilmDetailView(film: entry.film)
                                } label: {
                                    DiaryRow(
                                        entry: entry,
                                        viewing: model.viewingNumbers[entry.id] ?? 1,
                                        onEdit: { editing = entry },
                                        onDelete: { Task { await model.delete(entry) } }
                                    )
                                }
                                .buttonStyle(.plain)

                                Divider().overlay(Theme.border).padding(.leading, 20)
                            }
                        }
                    } header: {
                        if !month.title.isEmpty {
                            HStack {
                                Text(month.title)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Theme.foreground)
                                Text(
                                    month.entries.count == 1
                                        ? "1 Eintrag" : "\(month.entries.count) Einträge"
                                )
                                .font(.caption2)
                                .foregroundStyle(Theme.quiet)
                                .monospacedDigit()
                                Spacer()
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                            .background(Theme.background)
                        }
                    }
                }

                if let note = model.note {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .padding(.horizontal, 20)
                }
            }
            .padding(.vertical, 12)
        }
    }

    /// Drei Zahlen, nicht dreißig. Das Tagebuch soll erzählen, nicht
    /// auswerten.
    private var numbers: some View {
        HStack(spacing: 12) {
            Figure(value: "\(model.summary.entries)", label: "Einträge")
            Figure(value: "\(model.summary.thisYear)", label: "dieses Jahr")
            Figure(
                value: model.summary.average.map(Popcorn.format) ?? "—",
                label: "im Schnitt")
        }
        .padding(.horizontal, 20)
    }

    /// Schnell zwischen den Jahren wechseln — erst ab zwei.
    private var years: some View {
        @Bindable var model = model

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                DiaryChip(label: "Alle", isOn: model.year == nil) { model.year = nil }
                ForEach(model.availableYears, id: \.self) { year in
                    DiaryChip(label: String(year), isOn: model.year == year) {
                        model.year = model.year == year ? nil : year
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private var filters: some View {
        @Bindable var model = model

        return ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                if model.hasFilters {
                    DiaryChip(label: "Zurücksetzen", isOn: false) { model.clearFilters() }
                }
                DiaryChip(label: "Mit Bewertung", isOn: model.ratedState == .rated) {
                    model.ratedState = model.ratedState == .rated ? .any : .rated
                }
                DiaryChip(label: "Ohne Bewertung", isOn: model.ratedState == .unrated) {
                    model.ratedState = model.ratedState == .unrated ? .any : .unrated
                }
                DiaryChip(label: "Mit Rezension", isOn: model.onlyWithReview) {
                    model.onlyWithReview.toggle()
                }
                DiaryChip(label: "Wiedersehen", isOn: model.onlyRewatches) {
                    model.onlyRewatches.toggle()
                }
                ForEach(EntryVisibility.allCases, id: \.self) { option in
                    DiaryChip(label: option.label, isOn: model.visibility == option) {
                        model.visibility = model.visibility == option ? nil : option
                    }
                }
                ForEach(model.availableGenres) { genre in
                    DiaryChip(label: genre.shortLabel, isOn: model.genre?.id == genre.id) {
                        model.genre = model.genre?.id == genre.id ? nil : genre
                    }
                }
            }
            .padding(.horizontal, 20)
        }
    }
}

private struct Figure: View {
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundStyle(Theme.foreground)
                .monospacedDigit()
            Text(label)
                .font(.caption2)
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
        .overlay { RoundedRectangle(cornerRadius: 10).strokeBorder(Theme.border) }
    }
}

private struct DiaryChip: View {
    let label: String
    let isOn: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(isOn ? .semibold : .regular))
                .foregroundStyle(isOn ? Theme.onPrimary : Theme.foreground)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(isOn ? Theme.primary : Theme.card, in: Capsule())
                .overlay { Capsule().strokeBorder(isOn ? .clear : Theme.border) }
        }
        .buttonStyle(.plain)
    }
}

/// Eine Zeile im Tagebuch.
private struct DiaryRow: View {
    let entry: DiaryEntry
    /// Die wievielte Sichtung dieses Films — 1 bei der ersten.
    let viewing: Int
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            PosterThumbnail(film: entry.film, width: 48)

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    Text(entry.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.foreground)
                        .lineLimit(2)
                    if let year = entry.releaseYear {
                        Text(String(year))
                            .font(.caption2)
                            .foregroundStyle(Theme.quiet)
                            .monospacedDigit()
                    }
                    Spacer(minLength: 0)

                    // Drei Punkte statt nur langem Druck: ein Menü, das
                    // man nicht sieht, findet niemand.
                    Menu {
                        Button("Bearbeiten", systemImage: "pencil", action: onEdit)
                        Button(
                            "Eintrag löschen", systemImage: "trash", role: .destructive,
                            action: onDelete)
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.footnote)
                            .foregroundStyle(Theme.quiet)
                            .frame(width: 32, height: 28)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Mehr")
                }

                HStack(spacing: 8) {
                    if let rating = entry.rating {
                        PopcornRating(rating: Double(rating), size: 12)
                    }

                    // Gesehen am steht vorn. Das ist das Datum, um das
                    // es im Tagebuch geht.
                    Text(watchedLine)
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet)
                        .monospacedDigit()

                    // „3. Sichtung" sagt mehr als „Wiedergesehen".
                    if viewing > 1 {
                        Text("\(viewing). Sichtung")
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                            .monospacedDigit()
                    }

                    if entry.visibility != .publicly {
                        Text(entry.visibility.label)
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                    }
                }

                // Nur wenn beide Daten auseinanderliegen. Bei einem Film,
                // den man am selben Abend einträgt, wäre das Lärm.
                if entry.wasLoggedLater, let created = entry.createdDate {
                    Text("eingetragen am \(DiaryRow.short(created))")
                        .font(.caption2)
                        .foregroundStyle(Theme.quiet.opacity(0.8))
                        .monospacedDigit()
                }

                if let review = entry.review, !review.isEmpty {
                    SpoilerText(text: review, hasSpoilers: entry.hasSpoilers)
                }

                // Nachtragen, wo etwas fehlt (Tagebuch-Konzept).
                HStack(spacing: 12) {
                    if entry.rating == nil {
                        Button("Jetzt bewerten", action: onEdit)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.primary)
                    }
                    if (entry.review ?? "").isEmpty {
                        Button("Rezension hinzufügen", action: onEdit)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Theme.primary)
                    }
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 0)
        }
        .padding(.leading, 20)
        .padding(.trailing, 8)
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }

    /// Das Sehdatum, ausgeschrieben wie im Konzept: „29. Aug. 2026".
    private var watchedLine: String {
        guard let date = entry.effectiveDate else { return "" }
        let text = DiaryRow.long(date)
        // Ohne Sehdatum ist das, was dasteht, der Eintragszeitpunkt —
        // und das muss dabeistehen, sonst gibt die Zeile ein geratenes
        // Datum als sicheres aus.
        return entry.hasWatchedDate ? text : "eingetragen \(text)"
    }

    static func long(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "d. MMM yyyy"
        return formatter.string(from: date)
    }

    static func short(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "d. MMM"
        return formatter.string(from: date)
    }
}

/// Einen Eintrag ändern oder löschen.
private struct EditEntrySheet: View {
    let entry: DiaryEntry
    let onSave: (Int, Date?, String, Bool, EntryVisibility) -> Void
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @FocusState private var isWriting: Bool

    @State private var rating: Int
    @State private var review: String
    @State private var watchedOn: Date
    @State private var hasWatchedOn: Bool
    @State private var visibility: EntryVisibility
    @State private var hasSpoilers: Bool
    @State private var confirmingDelete = false

    init(
        entry: DiaryEntry, onSave: @escaping (Int, Date?, String, Bool, EntryVisibility) -> Void,
        onDelete: @escaping () -> Void
    ) {
        self.entry = entry
        self.onSave = onSave
        self.onDelete = onDelete
        _rating = State(initialValue: entry.rating ?? 0)
        _review = State(initialValue: entry.review ?? "")
        _watchedOn = State(
            initialValue: entry.watchedOn.flatMap(LiveFilmEntryRepository.dayFormatter.date)
                ?? Date())
        _hasWatchedOn = State(initialValue: entry.hasWatchedDate)
        _visibility = State(initialValue: entry.visibility)
        _hasSpoilers = State(initialValue: entry.hasSpoilers)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    GeometryReader { geometry in
                        PopcornPicker(
                            rating: $rating, size: Popcorn.size(fitting: geometry.size.width))
                    }
                    .frame(height: 48)
                    .listRowBackground(Theme.card)
                } header: {
                    Text("Bewertung")
                } footer: {
                    Text(rating == 0 ? "Ohne Bewertung geht es nicht." : Popcorn.format(rating))
                        .monospacedDigit()
                }

                Section {
                    TextEditor(text: $review)
                        .frame(minHeight: 90)
                        .scrollContentBackground(.hidden)
                        .focused($isWriting)
                        .listRowBackground(Theme.card)

                    if !review.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        Toggle("Enthält Spoiler", isOn: $hasSpoilers)
                            .listRowBackground(Theme.card)
                    }
                } header: {
                    Text("Rezension")
                } footer: {
                    if hasSpoilers {
                        Text("Die Rezension wird verdeckt, bis jemand tippt.")
                    }
                }

                Section("Gesehen am") {
                    Toggle("Datum angeben", isOn: $hasWatchedOn)
                        .listRowBackground(Theme.card)
                    if hasWatchedOn {
                        DatePicker("Datum", selection: $watchedOn, displayedComponents: .date)
                            .listRowBackground(Theme.card)
                    }
                }

                Section("Wer sieht den Eintrag") {
                    Picker("Sichtbarkeit", selection: $visibility) {
                        ForEach(EntryVisibility.allCases, id: \.self) { option in
                            Text(option.label).tag(option)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Theme.card)
                }

                Section {
                    Button("Eintrag löschen", role: .destructive) { confirmingDelete = true }
                        .listRowBackground(Theme.card)
                }
            }
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(Theme.background)
            .navigationTitle(entry.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") {
                        onSave(
                            rating, hasWatchedOn ? watchedOn : nil, review, hasSpoilers,
                            visibility)
                        dismiss()
                    }
                    .disabled(rating == 0)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    if isWriting {
                        Spacer()
                        Button("Fertig") { isWriting = false }
                    }
                }
            }
            // Löschen ist nicht rückgängig zu machen, also wird gefragt.
            .confirmationDialog(
                "Diesen Eintrag löschen?", isPresented: $confirmingDelete, titleVisibility: .visible
            ) {
                Button("Löschen", role: .destructive) {
                    onDelete()
                    dismiss()
                }
                Button("Abbrechen", role: .cancel) {}
            } message: {
                Text("Bewertung und Rezension sind danach weg.")
            }
        }
    }
}
