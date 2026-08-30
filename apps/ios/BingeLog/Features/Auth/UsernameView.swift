import SwiftUI

/// Den Benutzernamen wählen.
///
/// Kommt nach der ersten Anmeldung: ein Konto gibt es dann, ein Profil
/// noch nicht. Derselbe Schritt wie `/willkommen` im Web.
struct UsernameView: View {
    @Environment(SessionStore.self) private var session

    let profiles: ProfileRepository

    @State private var name = ""
    @State private var availability: NameAvailability = .empty
    @State private var isChecking = false
    @State private var isWorking = false
    @State private var checkTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Wähl deinen Namen")
                    .font(.largeTitle.weight(.semibold))
                Text("Er steht in deiner Profiladresse und unter allem, was du schreibst.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 6) {
                TextField("Name", text: $name)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    // Das Feld schreibt selbst klein und wirft weg, was
                    // nicht erlaubt ist. Eine rote Zeile für etwas, das
                    // die App selbst richtigstellen kann, ist eine Hürde
                    // ohne Zweck.
                    .onChange(of: name) { _, new in
                        let clean = Username.sanitise(new)
                        if clean != new { name = clean }
                        scheduleCheck(clean)
                    }

                HStack(spacing: 8) {
                    Text("Drei bis zwanzig Zeichen, nur Kleinbuchstaben, Ziffern und _.")
                        .foregroundStyle(.secondary)
                    if !name.isEmpty {
                        if isChecking {
                            Text("wird geprüft…").foregroundStyle(.secondary)
                        } else {
                            Text(availability.message)
                                .foregroundStyle(colour(for: availability))
                        }
                    }
                }
                .font(.caption)
            }

            if let problem = session.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task {
                    isWorking = true
                    _ = await session.chooseUsername(name)
                    isWorking = false
                }
            } label: {
                Text(isWorking ? "Wird gespeichert" : "Weiter")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isWorking || availability != .free)

            Button("Abmelden") {
                Task { await session.signOut() }
            }
            .font(.footnote)

            Spacer()
        }
        .padding(24)
    }

    private func colour(for state: NameAvailability) -> Color {
        switch state {
        case .free: .green
        case .taken, .reserved: .red
        default: .secondary
        }
    }

    /// Gebremst und abbrechbar, wie die Suche: eine Abfrage je
    /// Tastendruck wäre eine zu viel.
    private func scheduleCheck(_ value: String) {
        checkTask?.cancel()
        guard !value.isEmpty else {
            availability = .empty
            return
        }

        checkTask = Task {
            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else { return }
            isChecking = true
            let result = await profiles.availability(of: value)
            guard !Task.isCancelled else { return }
            availability = result
            isChecking = false
        }
    }
}
