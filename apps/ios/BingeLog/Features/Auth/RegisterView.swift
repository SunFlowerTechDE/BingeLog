import SwiftUI

/// Ein Konto anlegen.
///
/// Aufbau nach dem Entwurf vom 30.08.2026. Der Benutzername steht hier
/// und nicht in einem zweiten Schritt: wer sich anmeldet, hat sich einen
/// Namen ausgedacht, und ihn erst nach der Mailbestätigung abzufragen
/// reißt den Gedanken auseinander.
///
/// Gespeichert wird er trotzdem erst später — beim Registrieren gibt es
/// noch keine Sitzung, und `profiles` verlangt eine. Bis dahin liegt er
/// in den Metadaten des Kontos (`SessionStore.claimPendingUsername`).
struct RegisterView: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss

    let films: FilmRepository
    let profiles: ProfileRepository

    @State private var username = ""
    @State private var email = ""
    @State private var password = ""
    @State private var repeated = ""
    @State private var acceptedTerms = false
    @State private var availability: NameAvailability = .empty
    @State private var isChecking = false
    @State private var isWorking = false
    @State private var checkTask: Task<Void, Never>?
    @State private var wall: [Film] = []

    private var passwordLongEnough: Bool { password.count >= 8 }
    private var passwordsMatch: Bool { !repeated.isEmpty && password == repeated }

    private var canSubmit: Bool {
        availability == .free && !email.isEmpty && passwordLongEnough && passwordsMatch
            && acceptedTerms
    }

    var body: some View {
        ZStack(alignment: .top) {
            Theme.background.ignoresSafeArea()
            PosterWall(films: wall, height: 220).ignoresSafeArea(edges: .top)

            ScrollView {
                VStack(spacing: 20) {
                    if session.awaitingConfirmation {
                        confirmation.padding(.top, 120)
                    } else {
                        form
                    }
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 40)
            }
        }
        .task { wall = await films.wellKnownWithArtwork(limit: 12) }
        .overlay(alignment: .topTrailing) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                    .padding(10)
                    .background(.black.opacity(0.4), in: Circle())
            }
            .padding(.trailing, 20)
            .padding(.top, 12)
            .accessibilityLabel("Schließen")
        }
    }

    private var form: some View {
        VStack(spacing: 20) {
            Wordmark().padding(.top, 60)

            VStack(spacing: 8) {
                Text("Konto erstellen")
                    .font(.title.weight(.semibold))
                    .foregroundStyle(Theme.foreground)
                Text("Erstelle dein Konto und beginne, Filme zu entdecken, zu bewerten und zu speichern.")
                    .font(.subheadline)
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    AuthField(
                        symbol: "person",
                        placeholder: "Benutzername",
                        text: $username
                    )
                    .onChange(of: username) { _, new in
                        // Schreibt selbst klein und wirft weg, was nicht
                        // erlaubt ist. Eine rote Zeile für etwas, das die
                        // App richtigstellen kann, ist eine Hürde ohne
                        // Zweck.
                        let clean = Username.sanitise(new)
                        if clean != new { username = clean }
                        scheduleCheck(clean)
                    }

                    if !username.isEmpty {
                        Text(isChecking ? "wird geprüft…" : availability.message)
                            .font(.caption)
                            .foregroundStyle(isChecking ? Theme.muted : colour(for: availability))
                            .padding(.leading, 4)
                    }
                }

                AuthField(
                    symbol: "envelope",
                    placeholder: "E-Mail",
                    text: $email,
                    contentType: .emailAddress,
                    keyboard: .emailAddress
                )

                VStack(alignment: .leading, spacing: 6) {
                    AuthField(
                        symbol: "lock",
                        placeholder: "Passwort",
                        text: $password,
                        isSecure: true,
                        contentType: .newPassword
                    )
                    if !password.isEmpty && !passwordLongEnough {
                        Text("Mindestens acht Zeichen.")
                            .font(.caption)
                            .foregroundStyle(Theme.muted)
                            .padding(.leading, 4)
                    }
                }

                VStack(alignment: .leading, spacing: 6) {
                    AuthField(
                        symbol: "lock",
                        placeholder: "Passwort wiederholen",
                        text: $repeated,
                        isSecure: true,
                        contentType: .newPassword
                    )
                    if !repeated.isEmpty && !passwordsMatch {
                        Text("Die beiden stimmen nicht überein.")
                            .font(.caption)
                            .foregroundStyle(.red)
                            .padding(.leading, 4)
                    }
                }
            }

            terms

            if let problem = session.problem {
                Text(problem)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            PrimaryButton(
                title: isWorking ? "Wird angelegt" : "Registrieren",
                isDisabled: isWorking || !canSubmit
            ) {
                Task {
                    isWorking = true
                    await session.signUp(email: email, password: password, username: username)
                    isWorking = false
                }
            }

            HStack(spacing: 4) {
                Text("Bereits ein Konto?").foregroundStyle(Theme.muted)
                Button("Anmelden") { dismiss() }
                    .foregroundStyle(Theme.primary)
            }
            .font(.footnote)
            .padding(.top, 4)
        }
    }

    /// Die Zustimmung.
    ///
    /// **Beide Begriffe sind jetzt Links** und keine Behauptungen mehr:
    /// Datenschutzerklärung und Nutzungsbedingungen stehen seit dem
    /// 03.09.2026 auf der Webseite. Ein Häkchen unter Dokumenten, die es
    /// nicht gibt, war so viel wert wie die Dokumente.
    private var terms: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                acceptedTerms.toggle()
            } label: {
                Image(systemName: acceptedTerms ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundStyle(acceptedTerms ? Theme.primary : Theme.muted)
            }
            .accessibilityLabel("Nutzungsbedingungen und Datenschutzerklärung akzeptieren")
            .accessibilityAddTraits(acceptedTerms ? [.isSelected] : [])

            VStack(alignment: .leading, spacing: 2) {
                if let datenschutz = AppConfiguration.privacyPolicyURL,
                    let bedingungen = AppConfiguration.termsURL
                {
                    Text("Ich stimme den ")
                        .foregroundColor(Theme.muted)
                        + Text("[Nutzungsbedingungen](\(bedingungen.absoluteString))")
                        .foregroundColor(Theme.primary)
                        + Text(" und der ").foregroundColor(Theme.muted)
                        + Text("[Datenschutzerklärung](\(datenschutz.absoluteString))")
                        .foregroundColor(Theme.primary)
                        + Text(" zu.").foregroundColor(Theme.muted)
                } else {
                    Text("Ich stimme den Nutzungsbedingungen und der Datenschutzerklärung zu.")
                        .foregroundColor(Theme.muted)
                }

                // Steht dabei und nicht im Kleingedruckten: wer zu jung
                // ist, soll es hier erfahren und nicht nach der
                // Registrierung.
                Text("Mindestalter 16 Jahre.")
                    .foregroundColor(Theme.quiet)
            }
            .font(.footnote)
            .tint(Theme.primary)

            Spacer(minLength: 0)
        }
    }

    /// Nach dem Anlegen: die Adresse muss bestätigt werden.
    private var confirmation: some View {
        VStack(alignment: .leading, spacing: 16) {
            Image(systemName: "envelope")
                .font(.largeTitle)
                .foregroundStyle(Theme.primary)

            Text("Schau in dein Postfach")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Theme.foreground)

            Text(
                "Wir haben dir eine Mail geschickt. Bestätige die Adresse darin, "
                    + "dann kannst du dich hier anmelden. Dein Name @\(username) ist "
                    + "bis dahin für dich vorgemerkt."
            )
            .foregroundStyle(Theme.muted)

            PrimaryButton(title: "Zur Anmeldung") { dismiss() }
        }
    }

    private func colour(for state: NameAvailability) -> Color {
        switch state {
        case .free: .green
        case .taken, .reserved: .red
        default: Theme.muted
        }
    }

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
