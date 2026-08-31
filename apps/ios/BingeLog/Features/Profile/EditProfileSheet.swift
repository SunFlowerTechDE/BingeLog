import PhotosUI
import SwiftUI

/// Das eigene Profil bearbeiten.
///
/// Name, Beschreibung, Profilbild und Kopfbild. Die Favoriten stehen
/// nicht hier: dafür braucht es eine Filmsuche, und die gehört nicht in
/// ein Formular mit vier Feldern — sie bekommt einen eigenen Weg (M5
/// 5.6).
struct EditProfileSheet: View {
    let head: ProfileOverview
    let avatarBase: URL?
    let bannerBase: URL?
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(Repositories.self) private var repos
    @FocusState private var isWriting: Bool

    @State private var displayName: String
    @State private var bio: String
    @State private var avatarPick: PhotosPickerItem?
    @State private var bannerPick: PhotosPickerItem?
    @State private var isBusy = false
    @State private var note: String?

    init(
        head: ProfileOverview, avatarBase: URL?, bannerBase: URL?,
        onSaved: @escaping () -> Void
    ) {
        self.head = head
        self.avatarBase = avatarBase
        self.bannerBase = bannerBase
        self.onSaved = onSaved
        _displayName = State(initialValue: head.displayName ?? "")
        _bio = State(initialValue: head.bio ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name", text: $displayName)
                        .focused($isWriting)
                        .listRowBackground(Theme.card)
                } header: {
                    Text("Anzeigename")
                } footer: {
                    // Der Benutzername ist die Kennung und wird hier
                    // nicht geändert — das ist ein Eingriff mit Folgen
                    // für jeden Link auf dieses Profil.
                    Text("Deine Kennung @\(head.username) bleibt, wie sie ist.")
                }

                Section {
                    TextEditor(text: $bio)
                        .frame(minHeight: 90)
                        .scrollContentBackground(.hidden)
                        .focused($isWriting)
                        .listRowBackground(Theme.card)
                } header: {
                    Text("Über dich")
                } footer: {
                    Text("\(bio.count) von 500 Zeichen")
                        .monospacedDigit()
                        .foregroundStyle(bio.count > 500 ? .red : Theme.quiet)
                }

                Section("Bilder") {
                    PhotosPicker(selection: $avatarPick, matching: .images) {
                        LabeledContent("Profilbild") {
                            Text("ändern").foregroundStyle(Theme.primary)
                        }
                    }
                    .listRowBackground(Theme.card)

                    PhotosPicker(selection: $bannerPick, matching: .images) {
                        LabeledContent("Kopfbild") {
                            Text("ändern").foregroundStyle(Theme.primary)
                        }
                    }
                    .listRowBackground(Theme.card)
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
            .navigationTitle("Profil bearbeiten")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sichern") { Task { await save() } }
                        .disabled(isBusy || bio.count > 500 || displayName.count > 60)
                }
                ToolbarItemGroup(placement: .keyboard) {
                    if isWriting {
                        Spacer()
                        Button("Fertig") { isWriting = false }
                    }
                }
            }
            .onChange(of: avatarPick) { _, item in
                Task { await upload(item, isAvatar: true) }
            }
            .onChange(of: bannerPick) { _, item in
                Task { await upload(item, isAvatar: false) }
            }
        }
    }

    private func save() async {
        note = nil
        isBusy = true
        defer { isBusy = false }

        switch await repos.profileEdits.updateProfile(
            displayName: displayName, bio: bio)
        {
        case .saved:
            onSaved()
            dismiss()
        case .failed(let message):
            note = message
        }
    }

    /// Verkleinern, dann hochladen.
    ///
    /// Der Eimer nimmt 256 KB für Profilbilder und 400 KB für Kopfbilder.
    /// Ein Foto vom iPhone hat ein Vielfaches davon — es abzuweisen wäre
    /// richtig und trotzdem unbrauchbar, also wird es passend gemacht.
    private func upload(_ item: PhotosPickerItem?, isAvatar: Bool) async {
        guard let item else { return }
        note = nil
        isBusy = true
        defer { isBusy = false }

        guard let raw = try? await item.loadTransferable(type: Data.self),
            let image = UIImage(data: raw)
        else {
            note = "Das Bild konnte nicht gelesen werden."
            return
        }

        let limit = isAvatar ? 262_144 : 409_600
        guard
            let data = ImagePreparation.jpeg(
                from: image, longestSide: isAvatar ? 512 : 1280, limit: limit)
        else {
            note = "Das Bild lässt sich nicht klein genug machen. Nimm ein anderes."
            return
        }

        let outcome =
            isAvatar
            ? await repos.profileEdits.uploadAvatar(data)
            : await repos.profileEdits.uploadBanner(data)

        switch outcome {
        case .uploaded: onSaved()
        case .failed(let message): note = message
        }
    }
}
